import { StateStatus } from '../model/State';
import type { State } from '../model/State';
import type { StateId, TransitionId } from '../model/types';
import type { Transition } from '../model/Transition';
import type { StateContainer } from '../model/StateContainer';
import { TerminalState } from './TerminalState';

export class Region implements StateContainer {
  readonly id: string;

  readonly stateIds: Set<StateId> = new Set();

  readonly transitionIds: Set<TransitionId> = new Set();

  readonly terminal: TerminalState;

  status: StateStatus = StateStatus.None;

  payload: unknown = undefined;

  private readonly _parentStateId: StateId;

  constructor(id: string, addState: (s: State) => void, parentStateId: StateId) {
    this.id = id;
    this._parentStateId = parentStateId;
    this.terminal = new TerminalState(`${id}.__terminal` as StateId, parentStateId);
    addState(this.terminal);
    this.stateIds.add(this.terminal.id);
  }

  hasState(id: StateId): boolean {
 return this.stateIds.has(id); 
}

  addState(state: State): void {
    this.stateIds.add(state.id);
    state.parentId = this._parentStateId;
  }

  deleteState(id: StateId): void {
 this.stateIds.delete(id); 
}

  hasTransition(id: TransitionId): boolean {
 return this.transitionIds.has(id); 
}

  addTransition(transition: Transition): void {
    this.transitionIds.add(transition.id);
    transition.parentId = this._parentStateId;
  }

  deleteTransition(id: TransitionId): void {
 this.transitionIds.delete(id); 
}
}
