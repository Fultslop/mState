import type { SMStateId, SMStatus, SMTransitionId } from './types';
import type { ISMTransition } from './ISMTransition';

export class SMTransition implements ISMTransition {
  readonly id: SMTransitionId;
  readonly fromStateId: SMStateId;
  readonly toStateId: SMStateId;
  readonly status: SMStatus | undefined;
  readonly exitCode: string | undefined;

  constructor(
    id: SMTransitionId,
    fromStateId: SMStateId,
    toStateId: SMStateId,
    status?: SMStatus,
    exitCode?: string,
  ) {
    this.id = id;
    this.fromStateId = fromStateId;
    this.toStateId = toStateId;
    this.status = status;
    this.exitCode = exitCode;
  }
}
