import { StateType, StateStatus } from '../model/State';
import type { State } from '../model/State';
import type { StateId, TransitionId } from '../model/types';
import type { ExecutionContext } from './ExecutionContext';
import type { StateEntryHandler } from './StateEntryHandler';

export class ForkEntryHandler implements StateEntryHandler {
  readonly handledType = StateType.Fork;

  onEnter(
    ctx: ExecutionContext,
    _fromId: StateId,
    _transitionId: TransitionId,
    target: State,
    payload: unknown,
  ): void {
    ctx.markInactive(target.id);
    target.stateStatus = StateStatus.None;
    ctx.routeFrom(target.id, StateStatus.None, undefined, payload);
  }
}
