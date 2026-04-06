import { StateStatus } from "./IState";

export type StateMachineId = string & { readonly __brand: 'StateMachineId' };
export type StateId        = string & { readonly __brand: 'StateId' };
export type TransitionId   = string & { readonly __brand: 'TransitionId' };

export interface StateMachineStartedEvent<T = unknown> {
  statemachineId: StateMachineId;
  payload: T | undefined;
}

export interface StateStartEvent<T = unknown> {
  fromStateId: StateId;
  transitionId: TransitionId;
  toStateId: StateId;
  payload: T | undefined;
}

export interface StateStoppedEvent<T = unknown> {
  stateId: StateId;
  stateStatus: StateStatus;
  exitCode: string | undefined;
  payload: T | undefined;
}

export interface StateMachineStoppedEvent<T = unknown> {
  statemachineId: StateMachineId;
  stateStatus: StateStatus;
  payload: T | undefined;
}
