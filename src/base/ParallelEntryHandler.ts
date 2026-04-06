import { StateType, StateStatus } from '../model/State';
import type { State } from '../model/State';
import type { StateId, TransitionId } from '../model/types';
import type { ExecutionContext } from './ExecutionContext';
import type { StateEntryHandler } from './StateEntryHandler';
import type { ParallelState } from './ParallelState';
import { SMRuntimeException } from './SMRuntimeException';
import type { InitialState } from './InitialState';

export class ParallelEntryHandler implements StateEntryHandler {
  readonly handledType = StateType.Parallel;

  onEnter(
    ctx: ExecutionContext,
    fromId: StateId,
    transitionId: TransitionId,
    target: State,
    payload: unknown,
  ): void {
    const parallel = target as ParallelState;
    ctx.emitStateStart({
      fromStateId: fromId,
      transitionId,
      toStateId: target.id,
      payload,
    });

    for (const region of parallel.getRegions()) {
      region.status = StateStatus.Active;

      const initId = Array.from(region.stateIds).find(
        (id) => ctx.getState(id)?.type === StateType.Initial,
      );
      if (!initId) {
        throw new SMRuntimeException(
          `Region '${region.id}' in parallel '${parallel.id}' has no Initial state`,
        );
      }

      const regionInit = ctx.getState(initId) as InitialState;
      const regionPayload = parallel.payloadClone
        ? parallel.payloadClone(payload)
        : payload;
      const initPayload = regionInit.initialPayload ?? regionPayload;
      ctx.routeFrom(initId, StateStatus.None, undefined, initPayload);
    }
  }
}
