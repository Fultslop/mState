export type SMStateMachineId = string & { readonly __brand: 'SMStateMachineId' };
export type SMStateId        = string & { readonly __brand: 'SMStateId' };
export type SMTransitionId   = string & { readonly __brand: 'SMTransitionId' };

export enum SMStatus {
  None      = 'none',
  Active    = 'active',
  Ok        = 'ok',
  Error     = 'error',
  Canceled  = 'canceled',
  Exception = 'exception',
  AnyStatus = 'any',
}

export enum SMStateType {
  Initial     = 'initial',
  Terminal    = 'terminal',
  Choice      = 'choice',
  Fork        = 'fork',
  Join        = 'join',
  Group       = 'group',
  UserDefined = 'userDefined',
}

export interface SMStartedEvent<T = unknown> {
  statemachineId: SMStateMachineId;
  payload: T | undefined;
}

export interface SMStateStartEvent<T = unknown> {
  fromStateId: SMStateId;
  transitionId: SMTransitionId;
  toStateId: SMStateId;
  payload: T | undefined;
}

export interface SMStateStoppedEvent<T = unknown> {
  stateId: SMStateId;
  stateStatus: SMStatus;
  exitCode: string | undefined;
  payload: T | undefined;
}

export interface SMStoppedEvent<T = unknown> {
  statemachineId: SMStateMachineId;
  stateStatus: SMStatus;
  payload: T | undefined;
}
