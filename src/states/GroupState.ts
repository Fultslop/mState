import type { SMStateId} from '../types';
import { SMStateType } from '../types';
import type { IGroupState, ISMState } from '../interfaces';
import { BaseState } from './BaseState';

export class GroupState extends BaseState implements IGroupState {
  readonly memberIds: Set<SMStateId> = new Set();

  constructor(id: SMStateId, config?: Record<string, unknown>) {
    super(id, SMStateType.Group, config);
  }

  addMember(state: ISMState): void {
    this.memberIds.add(state.id);
  }

  hasMember(stateId: SMStateId): boolean {
    return this.memberIds.has(stateId);
  }
}
