import { ISMState } from './ISMState';
import type { SMStateId } from './types';


export interface IGroupState extends ISMState {
  readonly memberIds: Set<SMStateId>;
  hasMember(stateId: SMStateId): boolean;
  addMember(state: ISMState): void;
}
