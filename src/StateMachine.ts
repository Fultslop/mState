import type {
  SMStateMachineId, SMStateId, SMTransitionId,
  SMStartedEvent, SMStateStartEvent, SMStateStoppedEvent, SMStoppedEvent} from './types';
import { SMStatus, SMStateType
} from './types';
import type { ISMState, ISMTransition, ISMStateMachine, IJoinState, IGroupState } from './interfaces';
import { TypedEvent } from './TypedEvent';
import { StateRegistry } from './StateRegistry';
import { TransitionRegistry } from './TransitionRegistry';
import { TransitionRouter } from './TransitionRouter';
import { Validator } from './Validator';
import { SMTransition } from './SMTransition';
import { SMRuntimeException } from './exceptions';
import { InitialState } from './states/InitialState';
import { TerminalState } from './states/TerminalState';
import { UserDefinedState } from './states/UserDefinedState';
import { ChoiceState } from './states/ChoiceState';
import { ForkState } from './states/ForkState';
import { JoinState } from './states/JoinState';
import { GroupState } from './states/GroupState';

export class StateMachine implements ISMStateMachine {
  readonly id: SMStateMachineId;
  readonly onSMStarted    = new TypedEvent<SMStartedEvent>();
  readonly onStateStart   = new TypedEvent<SMStateStartEvent | SMStateStartEvent[]>();
  readonly onStateStopped = new TypedEvent<SMStateStoppedEvent>();
  readonly onSMStopped    = new TypedEvent<SMStoppedEvent>();

  private readonly _states      = new StateRegistry();
  private readonly _transitions = new TransitionRegistry();
  private readonly _router: TransitionRouter;
  private readonly _validator   = new Validator();
  private readonly _active      = new Set<SMStateId>();

  constructor(id: SMStateMachineId) {
    this.id = id;
    this._router = new TransitionRouter(this._states, this._transitions);
  }

  // ── Builder ──────────────────────────────────────────────────────────────

  createInitial(id: SMStateId, payload?: unknown): ISMState {
    const s = new InitialState(id, payload);
    this._states.add(s);
    return s;
  }

  createState(id: SMStateId, config?: Record<string, unknown>): ISMState {
    const s = new UserDefinedState(id, config);
    this._states.add(s);
    return s;
  }

  createTerminal(id: SMStateId): ISMState {
    const s = new TerminalState(id);
    this._states.add(s);
    return s;
  }

  createChoice(id: SMStateId): ISMState {
    const s = new ChoiceState(id);
    this._states.add(s);
    return s;
  }

  createFork(id: SMStateId, clonePayload?: (p: unknown) => unknown): ISMState {
    const s = new ForkState(id, clonePayload);
    this._states.add(s);
    return s;
  }

  createJoin(id: SMStateId): IJoinState {
    const s = new JoinState(id);
    this._states.add(s);
    return s;
  }

  createGroup(id: SMStateId, config?: Record<string, unknown>): IGroupState {
    const s = new GroupState(id, config);
    this._states.add(s);
    return s;
  }

  createTransition(
    id: SMTransitionId,
    fromId: SMStateId,
    toId: SMStateId,
    status?: SMStatus,
    exitCode?: string,
  ): ISMTransition {
    const t = new SMTransition(id, fromId, toId, status, exitCode);
    this._transitions.add(t);
    const from = this._states.get(fromId);
    const to   = this._states.get(toId);
    if (!from) throw new SMRuntimeException(`fromId '${fromId}' not found`);
    if (!to)   throw new SMRuntimeException(`toId '${toId}' not found`);
    from.outgoing.add(id);
    to.incoming.add(id);
    return t;
  }

  // ── Registry access ───────────────────────────────────────────────────────

  addState(state: ISMState): void { this._states.add(state); }
  removeState(id: SMStateId): void { this._states.remove(id); }
  getState(id: SMStateId): ISMState | undefined { return this._states.get(id); }
  getStateCount(): number { return this._states.count(); }
  getStateIds(): ReadonlyArray<SMStateId> { return this._states.ids(); }
  getActiveStateIds(): ReadonlyArray<SMStateId> { return Array.from(this._active); }

  addTransition(t: ISMTransition): void { this._transitions.add(t); }
  removeTransition(id: SMTransitionId): void { this._transitions.remove(id); }
  getTransition(id: SMTransitionId): ISMTransition | undefined { return this._transitions.get(id); }
  getTransitionCount(): number { return this._transitions.count(); }
  getTransitionIds(): ReadonlyArray<SMTransitionId> { return this._transitions.ids(); }

  validate(): void { this._validator.validate(this._states, this._transitions); }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  start(): void {
    const initials = this._states.all().filter(s => s.type === SMStateType.Initial);
    if (initials.length === 0) {
      throw new SMRuntimeException('No Initial state found — call createInitial() before start()');
    }

    this.onSMStarted.emit({ statemachineId: this.id, payload: undefined });

    for (const init of initials) {
      const initState = init as InitialState;
      this._routeFromState(init.id, SMStatus.None, undefined, initState.payload);
    }
  }

  stop(): void {
    for (const id of this._active) {
      const s = this._states.get(id);
      if (s) s.stateStatus = SMStatus.Canceled;
    }
    this._active.clear();
    this.onSMStopped.emit({ statemachineId: this.id, stateStatus: SMStatus.Canceled, payload: undefined });
  }

  onStopped(id: SMStateId, status: SMStatus, exitCode?: string, payload?: unknown): void {
    const state = this._states.get(id);
    if (!state) {
      throw new SMRuntimeException(`onStopped: state '${id}' not found`);
    }
    if (state.stateStatus !== SMStatus.Active) {
      throw new SMRuntimeException(`onStopped: state '${id}' is not Active (status: ${state.stateStatus})`);
    }

    state.stateStatus = status;
    this._active.delete(id);
    this.onStateStopped.emit({ stateId: id, stateStatus: status, exitCode, payload });

    this._routeFromState(id, status, exitCode, payload);
  }

  // ── Internal routing ──────────────────────────────────────────────────────

  private _routeFromState(
    fromId: SMStateId,
    status: SMStatus,
    exitCode: string | undefined,
    payload: unknown,
  ): void {
    const route = this._router.resolve(fromId, status, exitCode);

    switch (route.kind) {
      case 'none':
        throw new SMRuntimeException(`No outgoing transition from state '${fromId}'`);

      case 'noMatch':
        this.onSMStopped.emit({ statemachineId: this.id, stateStatus: SMStatus.Error, payload: undefined });
        break;

      case 'terminal': {
        const group = this._findGroupOwner(route.terminalId);
        if (group) {
          this._active.delete(group.id);
          group.stateStatus = status;
          this.onStateStopped.emit({ stateId: group.id, stateStatus: status, exitCode, payload });
          this._routeFromState(group.id, status, exitCode, payload);
        } else {
          this.onSMStopped.emit({ statemachineId: this.id, stateStatus: status, payload });
        }
        break;
      }

      case 'transition': {
        const from = this._states.get(fromId);
        if (from?.type === SMStateType.Fork) {
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
    fromId: SMStateId,
    transitionId: SMTransitionId,
    toId: SMStateId,
    payload: unknown,
    status: SMStatus = SMStatus.None,
    exitCode?: string,
  ): void {
    const target = this._states.get(toId);
    if (!target) throw new SMRuntimeException(`Target state '${toId}' not found`);

    target.stateStatus = SMStatus.Active;
    this._active.add(toId);

    if (target.type === SMStateType.Fork) {
      // Fork is a pseudo-state: immediately route through it without emitting onStateStart
      this._active.delete(toId);
      target.stateStatus = SMStatus.None;
      this._routeFromState(toId, status, exitCode, payload);
      return;
    }

    if (target.type === SMStateType.Group) {
      this.onStateStart.emit({ fromStateId: fromId, transitionId, toStateId: toId, payload });
      this._startGroup(target as GroupState, payload);
      return;
    }

    if (target.type === SMStateType.Join) {
      const join = target as JoinState;
      const evt: SMStateStartEvent = { fromStateId: fromId, transitionId, toStateId: toId, payload };
      join.onDependencyComplete(evt);
      this._active.delete(toId);
      target.stateStatus = SMStatus.None;

      if (join.isComplete) {
        const collectedPayloads = join.receivedPayloads;
        join.reset();
        this._routeFromState(join.id, SMStatus.Ok, undefined, collectedPayloads);
      }
      return;
    }

    this.onStateStart.emit({ fromStateId: fromId, transitionId, toStateId: toId, payload });
  }

  private _handleFork(
    transitionIds: SMTransitionId[],
    _fork: ISMState,
    payload: unknown,
  ): void {
    const events: SMStateStartEvent[] = [];
    for (const tId of transitionIds) {
      const t = this._transitions.get(tId);
      if (!t) continue;
      const target = this._states.get(t.toStateId);
      if (!target) continue;
      const fork = this._states.get(t.fromStateId);
      const clonedPayload = (fork as ForkState).clonePayload
        ? (fork as ForkState).clonePayload!(payload)
        : payload;
      target.stateStatus = SMStatus.Active;
      this._active.add(t.toStateId);
      events.push({ fromStateId: t.fromStateId, transitionId: tId, toStateId: t.toStateId, payload: clonedPayload });
    }
    this.onStateStart.emit(events);
  }

  private _startGroup(group: GroupState, payload: unknown): void {
    const initId = Array.from(group.memberIds).find(id => {
      return this._states.get(id)?.type === SMStateType.Initial;
    });
    if (!initId) throw new SMRuntimeException(`Group '${group.id}' has no Initial member state`);

    const groupInit = this._states.get(initId) as InitialState;
    const initPayload = groupInit.payload ?? payload;
    this._routeFromState(initId, SMStatus.None, undefined, initPayload);
  }

  private _findGroupOwner(terminalId: SMStateId): GroupState | undefined {
    for (const s of this._states.all()) {
      if (s.type === SMStateType.Group) {
        const g = s as GroupState;
        if (g.hasMember(terminalId)) return g;
      }
    }
    return undefined;
  }
}
