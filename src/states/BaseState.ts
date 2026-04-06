import type { StateId, TransitionId } from '../types';
import type { StateType } from '@src/IState';
import { StateStatus } from '@src/IState';
import type { IState } from '@src/IState';

export abstract class BaseState implements IState {
  readonly id: StateId;
  readonly type: StateType;
  stateStatus: StateStatus = StateStatus.None;
  readonly config: Record<string, unknown> | undefined;
  readonly incoming: Set<TransitionId> = new Set();
  readonly outgoing: Set<TransitionId> = new Set();

  constructor(id: StateId, type: StateType, config?: Record<string, unknown>) {
    this.id = id;
    this.type = type;
    this.config = config;
  }
}
