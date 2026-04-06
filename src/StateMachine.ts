import {
  SMStateMachineId, SMStateId, SMTransitionId, SMStatus, SMStateType,
  SMStartedEvent, SMStateStartEvent, SMStateStoppedEvent, SMStoppedEvent,
} from './types';
import { ISMState, ISMTransition, ISMStateMachine, IJoinState, IGroupState } from './interfaces';
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

  // ── Lifecycle — implemented in Task 10 ────────────────────────────────────

  start(): void { throw new Error('not yet implemented'); }
  stop(): void  { throw new Error('not yet implemented'); }
  onStopped(_id: SMStateId, _status: SMStatus, _exitCode?: string, _payload?: unknown): void {
    throw new Error('not yet implemented');
  }
}
