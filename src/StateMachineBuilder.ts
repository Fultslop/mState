import { SMRuntimeException } from './exceptions';
import type { IGroupState } from './IGroupState';
import type { IJoinState } from './IJoinState';
import type { IState, StateStatus } from './IState';
import type { IStateMachine } from './IStateMachine';
import type { ITransition } from './ITransition';
import { ChoiceState } from './states/ChoiceState';
import { ForkState } from './states/ForkState';
import { GroupState } from './states/GroupState';
import { InitialState } from './states/InitialState';
import { JoinState } from './states/JoinState';
import { TerminalState } from './states/TerminalState';
import { UserDefinedState } from './states/UserDefinedState';
import { Transition } from './Transition';
import type { StateId, TransitionId } from './types';

export class StateMachineBuilder {
  constructor(private readonly _stateMachine: IStateMachine) {}

  get stateMachine(): IStateMachine {
    return this._stateMachine;
  }

  createInitial(id: StateId, payload?: unknown): IState {
    const s = new InitialState(id, payload);
    this._stateMachine.addState(s);
    return s;
  }

  createState(id: StateId, config?: Record<string, unknown>): IState {
    const s = new UserDefinedState(id, config);
    this._stateMachine.addState(s);
    return s;
  }

  createTerminal(id: StateId): IState {
    const s = new TerminalState(id);
    this._stateMachine.addState(s);
    return s;
  }

  createChoice(id: StateId): IState {
    const s = new ChoiceState(id);
    this._stateMachine.addState(s);
    return s;
  }

  createFork(id: StateId, clonePayload?: (p: unknown) => unknown): IState {
    const s = new ForkState(id, clonePayload);
    this._stateMachine.addState(s);
    return s;
  }

  createJoin(id: StateId): IJoinState {
    const s = new JoinState(id);
    this._stateMachine.addState(s);
    return s;
  }

  createGroup(id: StateId, config?: Record<string, unknown>): IGroupState {
    const s = new GroupState(id, config);
    this._stateMachine.addState(s);
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
    this._stateMachine.addTransition(t);
    const from = this._stateMachine.getState(fromId);
    const to = this._stateMachine.getState(toId);
    if (!from) throw new SMRuntimeException(`fromId '${fromId}' not found`);
    if (!to) throw new SMRuntimeException(`toId '${toId}' not found`);
    from.outgoing.add(id);
    to.incoming.add(id);
    return t;
  }
}
