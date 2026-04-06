import type { State } from './State';
import type { Transition } from './Transition';
import type { StateId, TransitionId } from './types';

export interface GroupState extends State {
  readonly stateIds: Set<StateId>;
  readonly transitionIds: Set<TransitionId>;
  
  hasState(stateId: StateId): boolean;
  addState(state: State): void;
  deleteState(stateId: StateId): void;

  hasTransition(transitionId: TransitionId): boolean;
  addTransition(transitionId: Transition): void;
  deleteTransition(transitionId: TransitionId): void;
}
