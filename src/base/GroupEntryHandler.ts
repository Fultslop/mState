import { StateType, StateStatus } from '../model/State';
import type { State } from '../model/State';
import type { StateId, TransitionId } from '../model/types';
import type { ExecutionContext } from './ExecutionContext';
import type { StateEntryHandler } from './StateEntryHandler';
import type { GroupState } from '../model/GroupState';
import type { InitialState } from './InitialState';
import { SMRuntimeException } from './SMRuntimeException';

export class GroupEntryHandler implements StateEntryHandler {
  readonly handledType = StateType.Group;

  // eslint-disable-next-line class-methods-use-this
  onEnter(
    ctx: ExecutionContext,
    fromId: StateId,
    transitionId: TransitionId,
    target: State,
    payload: unknown,
  ): void {
    ctx.emitStateStart({
      fromStateId: fromId,
      transitionId,
      toStateId: target.id,
      payload,
    });

    const group = target as GroupState;
    const initId = Array.from(group.stateIds).find(
      (id) => ctx.getState(id)?.type === StateType.Initial,
    );
    if (!initId) {
      throw new SMRuntimeException(
        `Group '${group.id}' has no Initial member state`,
      );
    }

    const groupInit = ctx.getState(initId) as InitialState;
    const initPayload = groupInit.initialPayload ?? payload;
    ctx.routeFrom(initId, StateStatus.None, undefined, initPayload);
  }
}
