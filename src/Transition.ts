import type { StateId, TransitionId } from './types';
import type { StateStatus } from './IState';
import type { ITransition } from './ITransition';

export class Transition implements ITransition {
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
