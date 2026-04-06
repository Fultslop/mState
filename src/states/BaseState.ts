import type { StateId, TransitionId } from '../model/types';
import type { StateType } from '@src/model/State';
import { StateStatus } from '@src/model/State';
import type { State } from '@src/model/State';

export abstract class BaseState implements State {
  readonly id: StateId;
  readonly type: StateType;
  
  readonly config: Record<string, unknown> | undefined;
  readonly incoming: Set<TransitionId> = new Set();
  readonly outgoing: Set<TransitionId> = new Set();

  parentId: StateId | undefined;
  stateStatus: StateStatus = StateStatus.None;

  constructor(id: StateId, type: StateType, config?: Record<string, unknown>, parentId?: StateId) {
    this.id = id;
    this.type = type;
    this.config = config;
    this.parentId = parentId;
  }
}
