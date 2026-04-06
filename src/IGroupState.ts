import type { IState } from './IState';
import type { StateId } from './types';

export interface IGroupState extends IState {
  readonly memberIds: Set<StateId>;
  hasMember(stateId: StateId): boolean;
  addMember(state: IState): void;
}
