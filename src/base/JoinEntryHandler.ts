import { StateType, StateStatus } from '../model/State';
import type { State } from '../model/State';
import type { StateId, TransitionId } from '../model/types';
import type { ExecutionContext } from './ExecutionContext';
import type { StateEntryHandler } from './StateEntryHandler';
import type { JoinState } from '../model/JoinState';

export class JoinEntryHandler implements StateEntryHandler {
  readonly handledType = StateType.Join;

  onEnter(
    ctx: ExecutionContext,
    fromId: StateId,
    transitionId: TransitionId,
    target: State,
    payload: unknown,
  ): void {
    const join = target as JoinState;
    join.onDependencyComplete({
      fromStateId: fromId,
      transitionId,
      toStateId: target.id,
      payload,
    });
    ctx.markInactive(target.id);
    target.stateStatus = StateStatus.None;

    if (join.isComplete) {
      const collected = join.receivedPayloads;
      join.reset();
      ctx.routeFrom(join.id, StateStatus.Ok, undefined, collected);
    }
  }
}
