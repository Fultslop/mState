import type { State } from './State';
import type { Transition } from './Transition';
import type { StateId, TransitionId } from './types';

export interface StateContainer {
  readonly stateIds: Set<StateId>;
  readonly transitionIds: Set<TransitionId>;
  hasState(id: StateId): boolean;
  addState(state: State): void;
  deleteState(id: StateId): void;
  hasTransition(id: TransitionId): boolean;
  addTransition(transition: Transition): void;
  deleteTransition(id: TransitionId): void;
}
