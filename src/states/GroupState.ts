import type { StateId } from '../types';
import { StateType } from '@src/IState';
import type { IGroupState } from '@src/IGroupState';
import type { IState } from '@src/IState';
import { BaseState } from './BaseState';

export class GroupState extends BaseState implements IGroupState {
  readonly memberIds: Set<StateId> = new Set();

  constructor(id: StateId, config?: Record<string, unknown>) {
    super(id, StateType.Group, config);
  }

  addMember(state: IState): void {
    this.memberIds.add(state.id);
  }

  hasMember(stateId: StateId): boolean {
    return this.memberIds.has(stateId);
  }
}
