import type { StateId, TransitionId } from '../types';
import { StateType } from '@src/IState';
import type { IGroupState } from '@src/IGroupState';
import type { IState } from '@src/IState';
import { BaseState } from './BaseState';
import { ITransition } from '@src/ITransition';

export class GroupState extends BaseState implements IGroupState {
  readonly stateIds: Set<StateId> = new Set();
  readonly transitionIds: Set<TransitionId> = new Set();

  constructor(id: StateId, config?: Record<string, unknown>, parentId?: StateId) {
    super(id, StateType.Group, config, parentId);
  }

  addState(state: IState): void {
    this.stateIds.add(state.id);
    state.parentId = this.id;
  }

  hasState(stateId: StateId): boolean {
    return this.stateIds.has(stateId);
  }

  deleteState(stateId: StateId): void {
    this.stateIds.delete(stateId);
  }

  addTransition(transition: ITransition): void {
    this.transitionIds.add(transition.id);
    transition.parentId = this.id;
  }

  hasTransition(transitionId: TransitionId): boolean {
    return this.transitionIds.has(transitionId);
  }

  deleteTransition(transitionId: TransitionId): void {
    this.transitionIds.delete(transitionId);
  }
}
