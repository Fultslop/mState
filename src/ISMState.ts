import type { SMStateId, SMStateType, SMStatus, SMTransitionId } from './types';


export interface ISMState {
  readonly id: SMStateId;
  readonly type: SMStateType;
  stateStatus: SMStatus;
  readonly config: Record<string, unknown> | undefined;
  readonly incoming: Set<SMTransitionId>;
  readonly outgoing: Set<SMTransitionId>;
}
