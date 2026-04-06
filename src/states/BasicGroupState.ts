import type { StateId, TransitionId } from '../model/types';
import { StateType } from '@src/model/State';
import type { GroupState } from '@src/model/GroupState';
import type { State } from '@src/model/State';
import { BaseState } from './BaseState';
import type { Transition } from '@src/model/Transition';

export class BasicGroupState extends BaseState implements GroupState {
  readonly stateIds: Set<StateId> = new Set();
  readonly transitionIds: Set<TransitionId> = new Set();

  constructor(id: StateId, config?: Record<string, unknown>, parentId?: StateId) {
    super(id, StateType.Group, config, parentId);
  }

  addState(state: State): void {
    this.stateIds.add(state.id);
    state.parentId = this.id;
  }

  hasState(stateId: StateId): boolean {
    return this.stateIds.has(stateId);
  }

  deleteState(stateId: StateId): void {
    this.stateIds.delete(stateId);
  }

  addTransition(transition: Transition): void {
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
