import { SMStateId, SMStateType, SMStatus, SMTransitionId } from '../types';
import { ISMState } from '../interfaces';

export abstract class BaseState implements ISMState {
  readonly id: SMStateId;
  readonly type: SMStateType;
  stateStatus: SMStatus = SMStatus.None;
  readonly config: Record<string, unknown> | undefined;
  readonly incoming: Set<SMTransitionId> = new Set();
  readonly outgoing: Set<SMTransitionId> = new Set();

  constructor(id: SMStateId, type: SMStateType, config?: Record<string, unknown>) {
    this.id = id;
    this.type = type;
    this.config = config;
  }
}
