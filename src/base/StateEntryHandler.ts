import type { StateType } from '../model/State';
import type { State } from '../model/State';
import type { StateId, TransitionId } from '../model/types';
import type { ExecutionContext } from './ExecutionContext';

export interface StateEntryHandler {
  readonly handledType: StateType;
  onEnter(
    ctx: ExecutionContext,
    fromId: StateId,
    transitionId: TransitionId,
    target: State,
    payload: unknown,
  ): void;
}
