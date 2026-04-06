import { BasicStateMachine } from './BasicStateMachine';
import { SMRuntimeException } from './exceptions';
import type { IGroupState } from './IGroupState';
import type { IJoinState } from './IJoinState';
import type { IState, StateStatus, StateType } from './IState';
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
import type { StateId, StateMachineId, TransitionId } from './types';

export class BuildSession {
    
  private readonly _stateMachine: IStateMachine;
  private readonly _builder: StateMachineBuilder;

  constructor(stateMachine?: IStateMachine) {
    this._stateMachine = stateMachine || new BasicStateMachine(`stateMachine#${crypto.randomUUID()}` as StateMachineId );
    this._builder = new StateMachineBuilder(this._stateMachine)
    return this;
  }

  createInitial(id?: StateId, payload?: unknown): BuildSession {
    this._builder.createInitial(id || `initial#${crypto.randomUUID()}` as StateId, payload);
    return this;
  }
}

export class StateMachineBuilder {
  constructor(private readonly _stateMachine: IStateMachine) {}

  get stateMachine(): IStateMachine {
    return this._stateMachine;
  }

  createInitial(id: StateId, payload?: unknown, parent?: StateId): IState {
    const s = new InitialState(id, payload, parent);
    this._stateMachine.addState(s);
    return s;
  }

  createState(id: StateId, config?: Record<string, unknown>, parent?: StateId): IState {
    const s = new UserDefinedState(id, config, parent);
    this._stateMachine.addState(s);
    return s;
  }

  createTerminal(id: StateId, parent?: StateId): IState {
    const s = new TerminalState(id, parent);
    this._stateMachine.addState(s);
    return s;
  }

  createChoice(id: StateId, parent?: StateId): IState {
    const s = new ChoiceState(id, parent);
    this._stateMachine.addState(s);
    return s;
  }

  createFork(id: StateId, clonePayload?: (p: unknown) => unknown, parent?: StateId): IState {
    const s = new ForkState(id, clonePayload, parent);
    this._stateMachine.addState(s);
    return s;
  }

  createJoin(id: StateId, parent?: StateId): IJoinState {
    const s = new JoinState(id, parent);
    this._stateMachine.addState(s);
    return s;
  }

  createGroup(id: StateId, config?: Record<string, unknown>, parent?: StateId): IGroupState {
    const s = new GroupState(id, config, parent);
    this._stateMachine.addState(s);
    return s;
  }

  createTransition(
    id: TransitionId,
    fromId: StateId,
    toId: StateId,
    status?: StateStatus,
    exitCode?: string,
    parent?: StateId
  ): ITransition {
    const t = new Transition(id, fromId, toId, status, exitCode, parent);
    this._stateMachine.addTransition(t);
    const from = this._stateMachine.getState(fromId);
    
    if (!from) throw new SMRuntimeException(`fromId '${fromId}' not found`);
    
    const to = this._stateMachine.getState(toId);
    if (!to) throw new SMRuntimeException(`toId '${toId}' not found`);

    from.outgoing.add(id);
    to.incoming.add(id);
    
    return t;
  }
}
