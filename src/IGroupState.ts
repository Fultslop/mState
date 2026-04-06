import type { IState } from './IState';
import { ITransition } from './ITransition';
import type { StateId, TransitionId } from './types';

export interface IGroupState extends IState {
  readonly stateIds: Set<StateId>;
  readonly transitionIds: Set<TransitionId>;
  
  hasState(stateId: StateId): boolean;
  addState(state: IState): void;
  deleteState(stateId: StateId): void;

  hasTransition(transitionId: TransitionId): boolean;
  addTransition(transitionId: ITransition): void;
  deleteTransition(transitionId: TransitionId): void;
}
