import type { SMTransitionId, SMStateId, SMStatus } from './types';


export interface ISMTransition {
  readonly id: SMTransitionId;
  readonly fromStateId: SMStateId;
  readonly toStateId: SMStateId;
  readonly status: SMStatus | undefined;
  readonly exitCode: string | undefined;
}
