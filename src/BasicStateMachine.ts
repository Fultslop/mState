import type {
  StateMachineId,
  StateId,
  TransitionId,
  StateMachineStartedEvent,
  StateStartEvent,
  StateStoppedEvent,
  StateMachineStoppedEvent,
} from './types';
import { StateStatus, StateType } from './IState';
import type { IStateMachine } from './IStateMachine';
import type { IGroupState } from './IGroupState';
import type { IJoinState } from './IJoinState';
import type { ITransition } from './ITransition';
import type { IState } from './IState';
import { TypedEvent } from './TypedEvent';
import { StateRegistry } from './StateRegistry';
import { TransitionRegistry } from './TransitionRegistry';
import { TransitionRouter } from './TransitionRouter';
import { Validator } from './Validator';
import { Transition } from './Transition';
import { SMRuntimeException } from './exceptions';
import { InitialState } from './states/InitialState';
import { TerminalState } from './states/TerminalState';
import { UserDefinedState } from './states/UserDefinedState';
import { ChoiceState } from './states/ChoiceState';
import { ForkState } from './states/ForkState';
import { JoinState } from './states/JoinState';
import { GroupState } from './states/GroupState';

export class BasicStateMachine implements IStateMachine {
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

  // ── Builder ──────────────────────────────────────────────────────────────

  createInitial(id: StateId, payload?: unknown): IState {
    const s = new InitialState(id, payload);
    this._states.add(s);
    return s;
  }

  createState(id: StateId, config?: Record<string, unknown>): IState {
    const s = new UserDefinedState(id, config);
    this._states.add(s);
    return s;
  }

  createTerminal(id: StateId): IState {
    const s = new TerminalState(id);
    this._states.add(s);
    return s;
  }

  createChoice(id: StateId): IState {
    const s = new ChoiceState(id);
    this._states.add(s);
    return s;
  }

  createFork(id: StateId, clonePayload?: (p: unknown) => unknown): IState {
    const s = new ForkState(id, clonePayload);
    this._states.add(s);
    return s;
  }

  createJoin(id: StateId): IJoinState {
    const s = new JoinState(id);
    this._states.add(s);
    return s;
  }

  createGroup(id: StateId, config?: Record<string, unknown>): IGroupState {
    const s = new GroupState(id, config);
    this._states.add(s);
    return s;
  }

  createTransition(
    id: TransitionId,
    fromId: StateId,
    toId: StateId,
    status?: StateStatus,
    exitCode?: string,
  ): ITransition {
    const t = new Transition(id, fromId, toId, status, exitCode);
    this._transitions.add(t);
    const from = this._states.get(fromId);
    const to = this._states.get(toId);
    if (!from) throw new SMRuntimeException(`fromId '${fromId}' not found`);
    if (!to) throw new SMRuntimeException(`toId '${toId}' not found`);
    from.outgoing.add(id);
    to.incoming.add(id);
    return t;
  }

  // ── Registry access ───────────────────────────────────────────────────────

  addState(state: IState): void {
    this._states.add(state);
  }
  removeState(id: StateId): void {
    this._states.remove(id);
  }
  getState(id: StateId): IState | undefined {
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

  addTransition(t: ITransition): void {
    this._transitions.add(t);
  }
  removeTransition(id: TransitionId): void {
    this._transitions.remove(id);
  }
  getTransition(id: TransitionId): ITransition | undefined {
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
      this._routeFromState(init.id, StateStatus.None, undefined, initState.payload);
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

  private _handleFork(transitionIds: TransitionId[], _fork: IState, payload: unknown): void {
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
    const initId = Array.from(group.memberIds).find((id) => {
      return this._states.get(id)?.type === StateType.Initial;
    });
    if (!initId) throw new SMRuntimeException(`Group '${group.id}' has no Initial member state`);

    const groupInit = this._states.get(initId) as InitialState;
    const initPayload = groupInit.payload ?? payload;
    this._routeFromState(initId, StateStatus.None, undefined, initPayload);
  }

  private _findGroupOwner(terminalId: StateId): GroupState | undefined {
    for (const s of this._states.all()) {
      if (s.type === StateType.Group) {
        const g = s as GroupState;
        if (g.hasMember(terminalId)) return g;
      }
    }
    return undefined;
  }
}
