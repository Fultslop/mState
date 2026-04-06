import type { TransitionId, StateId } from './types';
import type { StateStatus } from "./IState";


export interface ITransition {
  readonly id: TransitionId;
  readonly fromStateId: StateId;
  readonly toStateId: StateId;
  readonly status: StateStatus | undefined;
  readonly exitCode: string | undefined;
}
