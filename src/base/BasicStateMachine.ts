import type {
  StateMachineId,
  StateId,
  TransitionId,
  StateMachineStartedEvent,
  StateStartEvent,
  StateStoppedEvent,
  StateMachineStoppedEvent,
} from '../model/types';
import { StateStatus, StateType } from '../model/State';
import type { StateMachine } from '../model/StateMachine';
import type { State } from '../model/State';
import { TypedEvent } from '../common/TypedEvent';
import { StateRegistry } from './StateRegistry';
import { TransitionRegistry } from './TransitionRegistry';
import { TransitionRouter } from './TransitionRouter';
import { Validator } from './Validator';
import { SMRuntimeException } from './exceptions';
import type { InitialState } from '../states/InitialState';
import type { ForkState } from '../states/ForkState';
import { requiresTruthy } from '../common/requires';
import type { Transition } from '../model/Transition';
import type { GroupState } from '../model/GroupState';
import type { JoinState } from '../model/JoinState';

export class BasicStateMachine implements StateMachine {
  readonly id: StateMachineId;
  readonly onStateMachineStarted = new TypedEvent<StateMachineStartedEvent>();
  readonly onStateStart = new TypedEvent<StateStartEvent | StateStartEvent[]>();
  readonly onStateStopped = new TypedEvent<StateStoppedEvent>();
  readonly onStateMachineStopped = new TypedEvent<StateMachineStoppedEvent>();

  private readonly _states = new StateRegistry();
  private readonly _transitions = new TransitionRegistry();
  private readonly _router: TransitionRouter;
  private readonly _validator = new Validator();
  private readonly _active = new Set<StateId>();

  constructor(id: StateMachineId) {
    this.id = id;
    this._router = new TransitionRouter(this._states, this._transitions);
  }

  // ── Registry access ───────────────────────────────────────────────────────

  addState(state: State): void {
    this._states.add(state);
  }

  deleteState(id: StateId): void {
    const state = this.getState(id);
    requiresTruthy(state, `cannot find state with id ${id}.`);

    // For a GroupState, recursively delete all children first so their
    // own transitions are cleaned up before we process the group's own edges.
    if (state.type === StateType.Group) {
      const group = state as GroupState;
      for (const childId of [...group.stateIds]) {
        this.deleteState(childId);
      }
      // Any transitions explicitly tracked by the group that were not yet
      // removed by the child-state deletions above.
      for (const tId of [...group.transitionIds]) {
        if (this._transitions.get(tId)) this.deleteTransition(tId);
      }
    }

    // Remove every transition that touches this state.
    for (const tId of [...state.incoming, ...state.outgoing]) {
      if (this._transitions.get(tId)) this.deleteTransition(tId);
    }

    // Detach from parent GroupState if applicable.
    if (state.parentId) {
      const parent = this._states.get(state.parentId);
      if (parent?.type === StateType.Group) {
        (parent as GroupState).deleteState(id);
      }
    }

    this._active.delete(id);
    this._states.remove(id);
  }

  getState(id: StateId): State | undefined {
    return this._states.get(id);
  }

  getStateCount(): number {
    return this._states.count();
  }

  getStateIds(): ReadonlyArray<StateId> {
    return this._states.ids();
  }
  
  getActiveStateIds(): ReadonlyArray<StateId> {
    return Array.from(this._active);
  }

  addTransition(t: Transition): void {
    this._transitions.add(t);
  }

  deleteTransition(id: TransitionId): void {
    const t = this._transitions.get(id);
    if (!t) return;

    // Remove from the from-state's outgoing set.
    this._states.get(t.fromStateId)?.outgoing.delete(id);

    // Remove from the to-state's incoming set.
    this._states.get(t.toStateId)?.incoming.delete(id);

    // Detach from parent GroupState if applicable.
    if (t.parentId) {
      const parent = this._states.get(t.parentId);
      if (parent?.type === StateType.Group) {
        (parent as GroupState).deleteTransition(id);
      }
    }

    this._transitions.remove(id);
  }

  getTransition(id: TransitionId): Transition | undefined {
    return this._transitions.get(id);
  }

  getTransitionCount(): number {
    return this._transitions.count();
  }

  getTransitionIds(): ReadonlyArray<TransitionId> {
    return this._transitions.ids();
  }

  validate(): void {
    this._validator.validate(this._states, this._transitions);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  start(): void {
    const initials = this._states.all().filter((s) => s.type === StateType.Initial);
    if (initials.length === 0) {
      throw new SMRuntimeException('No Initial state found — call createInitial() before start()');
    }

    this.onStateMachineStarted.emit({ statemachineId: this.id, payload: undefined });

    for (const init of initials) {
      const initState = init as InitialState;
      this._routeFromState(init.id, StateStatus.None, undefined, initState.initialPayload);
    }
  }

  stop(): void {
    for (const id of this._active) {
      const s = this._states.get(id);
      if (s) s.stateStatus = StateStatus.Canceled;
    }
    this._active.clear();
    this.onStateMachineStopped.emit({
      statemachineId: this.id,
      stateStatus: StateStatus.Canceled,
      payload: undefined,
    });
  }

  onStopped(id: StateId, status: StateStatus, exitCode?: string, payload?: unknown): void {
    const state = this._states.get(id);
    if (!state) {
      throw new SMRuntimeException(`onStopped: state '${id}' not found`);
    }
    if (state.stateStatus !== StateStatus.Active) {
      throw new SMRuntimeException(
        `onStopped: state '${id}' is not Active (status: ${state.stateStatus})`,
      );
    }

    state.stateStatus = status;
    this._active.delete(id);
    this.onStateStopped.emit({ stateId: id, stateStatus: status, exitCode, payload });

    this._routeFromState(id, status, exitCode, payload);
  }

  // ── Internal routing ──────────────────────────────────────────────────────

  private _routeFromState(
    fromId: StateId,
    status: StateStatus,
    exitCode: string | undefined,
    payload: unknown,
  ): void {
    const route = this._router.resolve(fromId, status, exitCode);

    switch (route.kind) {
      case 'none':
        throw new SMRuntimeException(`No outgoing transition from state '${fromId}'`);

      case 'noMatch':
        this.onStateMachineStopped.emit({
          statemachineId: this.id,
          stateStatus: StateStatus.Error,
          payload: undefined,
        });
        break;

      case 'terminal': {
        const group = this._findGroupOwner(route.terminalId);
        if (group) {
          this._active.delete(group.id);
          group.stateStatus = status;
          this.onStateStopped.emit({ stateId: group.id, stateStatus: status, exitCode, payload });
          this._routeFromState(group.id, status, exitCode, payload);
        } else {
          this.onStateMachineStopped.emit({
            statemachineId: this.id,
            stateStatus: status,
            payload,
          });
        }
        break;
      }

      case 'transition': {
        const from = this._states.get(fromId);
        if (from?.type === StateType.Fork) {
          this._handleFork(route.transitionIds, from, payload);
        } else {
          const tId = route.transitionIds[0];
          if (tId === undefined) return;
          const t = this._transitions.get(tId);
          if (!t) return;
          this._enterState(t.fromStateId, t.id, t.toStateId, payload, status, exitCode);
        }
        break;
      }
    }
  }

  private _enterState(
    fromId: StateId,
    transitionId: TransitionId,
    toId: StateId,
    payload: unknown,
    status: StateStatus = StateStatus.None,
    exitCode?: string,
  ): void {
    const target = this._states.get(toId);
    if (!target) throw new SMRuntimeException(`Target state '${toId}' not found`);

    target.stateStatus = StateStatus.Active;
    this._active.add(toId);

    if (target.type === StateType.Fork) {
      // Fork is a pseudo-state: immediately route through it without emitting onStateStart
      this._active.delete(toId);
      target.stateStatus = StateStatus.None;
      this._routeFromState(toId, status, exitCode, payload);
      return;
    }

    if (target.type === StateType.Group) {
      this.onStateStart.emit({ fromStateId: fromId, transitionId, toStateId: toId, payload });
      this._startGroup(target as GroupState, payload);
      return;
    }

    if (target.type === StateType.Join) {
      const join = target as JoinState;
      const evt: StateStartEvent = { fromStateId: fromId, transitionId, toStateId: toId, payload };
      join.onDependencyComplete(evt);
      this._active.delete(toId);
      target.stateStatus = StateStatus.None;

      if (join.isComplete) {
        const collectedPayloads = join.receivedPayloads;
        join.reset();
        this._routeFromState(join.id, StateStatus.Ok, undefined, collectedPayloads);
      }
      return;
    }

    this.onStateStart.emit({ fromStateId: fromId, transitionId, toStateId: toId, payload });
  }

  private _handleFork(transitionIds: TransitionId[], _fork: State, payload: unknown): void {
    const events: StateStartEvent[] = [];
    for (const tId of transitionIds) {
      const t = this._transitions.get(tId);
      if (!t) continue;
      const target = this._states.get(t.toStateId);
      if (!target) continue;
      const fork = this._states.get(t.fromStateId);
      const clonedPayload = (fork as ForkState).clonePayload
        ? (fork as ForkState).clonePayload!(payload)
        : payload;
      target.stateStatus = StateStatus.Active;
      this._active.add(t.toStateId);
      events.push({
        fromStateId: t.fromStateId,
        transitionId: tId,
        toStateId: t.toStateId,
        payload: clonedPayload,
      });
    }
    this.onStateStart.emit(events);
  }

  private _startGroup(group: GroupState, payload: unknown): void {
    const initId = Array.from(group.stateIds).find((id) => {
      return this._states.get(id)?.type === StateType.Initial;
    });
    if (!initId) throw new SMRuntimeException(`Group '${group.id}' has no Initial member state`);

    const groupInit = this._states.get(initId) as InitialState;
    const initPayload = groupInit.initialPayload ?? payload;
    this._routeFromState(initId, StateStatus.None, undefined, initPayload);
  }

  private _findGroupOwner(terminalId: StateId): GroupState | undefined {
    for (const s of this._states.all()) {
      if (s.type === StateType.Group) {
        const g = s as GroupState;
        if (g.hasState(terminalId)) return g;
      }
    }
    return undefined;
  }
}
