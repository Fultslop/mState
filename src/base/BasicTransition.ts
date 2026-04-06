import type { StateId, TransitionId } from '../model/types';
import type { StateStatus } from '../model/State';
import type { Transition } from '../model/Transition';

export class BasicTransition implements Transition {
  readonly id: TransitionId;

  readonly fromStateId: StateId;

  readonly toStateId: StateId;

  readonly status: StateStatus | undefined;

  readonly exitCode: string | undefined;
  
  parentId: StateId | undefined

  constructor(
    id: TransitionId,
    fromStateId: StateId,
    toStateId: StateId,
    status?: StateStatus,
    exitCode?: string,
    parentId? : StateId
  ) {
    this.id = id;
    this.fromStateId = fromStateId;
    this.toStateId = toStateId;
    this.status = status;
    this.exitCode = exitCode;
    this.parentId = parentId;
  }
}
