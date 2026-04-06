import type { StateId, TransitionId } from './types';

export enum StateStatus {
  None = 'none',
  Active = 'active',
  Ok = 'ok',
  Error = 'error',
  Canceled = 'canceled',
  Exception = 'exception',
  AnyStatus = 'any',
}

export enum StateType {
  Initial = 'initial',
  Terminal = 'terminal',
  Choice = 'choice',
  Fork = 'fork',
  Join = 'join',
  Group = 'group',
  UserDefined = 'userDefined',
}

export interface State {
  readonly id: StateId;
  readonly type: StateType; 
  readonly config: Record<string, unknown> | undefined;
  readonly incoming: Set<TransitionId>;
  readonly outgoing: Set<TransitionId>;

  parentId: StateId | undefined;
  stateStatus: StateStatus;
}
