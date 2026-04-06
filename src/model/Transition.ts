import type { TransitionId, StateId } from './types';
import type { StateStatus } from './State';

export interface Transition {
  readonly id: TransitionId;
  readonly fromStateId: StateId;
  readonly toStateId: StateId;
  readonly status: StateStatus | undefined;
  readonly exitCode: string | undefined;

  parentId: StateId | undefined;
}
