import { BasicStateMachine } from './BasicStateMachine';
import { SMRuntimeException } from './exceptions';
import type { State, StateStatus } from '../model/State';
import type { StateMachine } from '../model/StateMachine';
import { ChoiceState } from './ChoiceState';
import { ForkState } from './ForkState';
import { BasicGroupState } from './BasicGroupState';
import { InitialState } from './InitialState';
import { BasicJoinState } from './BasicJoinState';
import { TerminalState } from './TerminalState';
import { UserDefinedState } from './UserDefinedState';
import { BasicTransition } from './BasicTransition';
import type { StateId, StateMachineId, TransitionId } from '../model/types';
import type { Transition } from '../model/Transition';
import type { JoinState } from '../model/JoinState';
import type { GroupState } from '../model/GroupState';

export class BuildSession {
    
  private readonly _stateMachine: StateMachine;
  private readonly _builder: StateMachineBuilder;

  constructor(stateMachine?: StateMachine) {
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
  constructor(private readonly _stateMachine: StateMachine) {}

  get stateMachine(): StateMachine {
    return this._stateMachine;
  }

  createInitial(id: StateId, payload?: unknown, parent?: StateId): State {
    const s = new InitialState(id, payload, parent);
    this._stateMachine.addState(s);
    return s;
  }

  createState(id: StateId, config?: Record<string, unknown>, parent?: StateId): State {
    const s = new UserDefinedState(id, config, parent);
    this._stateMachine.addState(s);
    return s;
  }

  createTerminal(id: StateId, parent?: StateId): State {
    const s = new TerminalState(id, parent);
    this._stateMachine.addState(s);
    return s;
  }

  createChoice(id: StateId, parent?: StateId): State {
    const s = new ChoiceState(id, parent);
    this._stateMachine.addState(s);
    return s;
  }

  createFork(id: StateId, clonePayload?: (p: unknown) => unknown, parent?: StateId): State {
    const s = new ForkState(id, clonePayload, parent);
    this._stateMachine.addState(s);
    return s;
  }

  createJoin(id: StateId, parent?: StateId): JoinState {
    const s = new BasicJoinState(id, parent);
    this._stateMachine.addState(s);
    return s;
  }

  createGroup(id: StateId, config?: Record<string, unknown>, parent?: StateId): GroupState {
    const s = new BasicGroupState(id, config, parent);
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
  ): Transition {
    const t = new BasicTransition(id, fromId, toId, status, exitCode, parent);
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
