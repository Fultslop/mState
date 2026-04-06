import type { TypedEvent } from '@src/common/TypedEvent';

import type { StateStatus, State } from './State';
import type { Transition } from './Transition';

import type {
  StateMachineId,
  StateMachineStartedEvent,
  StateStartEvent,
  StateStoppedEvent,
  StateMachineStoppedEvent,
  StateId,
  TransitionId,
} from './types';

export interface StateMachine {
  readonly id: StateMachineId;

  readonly onStateMachineStarted: TypedEvent<StateMachineStartedEvent>;
  readonly onStateStart: TypedEvent<StateStartEvent | StateStartEvent[]>;
  readonly onStateStopped: TypedEvent<StateStoppedEvent>;
  readonly onStateMachineStopped: TypedEvent<StateMachineStoppedEvent>;

  start(): void;
  stop(): void;
  validate(): void;

  onStopped(id: StateId, status: StateStatus, exitCode?: string, payload?: unknown): void;
  
  getState(id: StateId): State | undefined;
  getStateCount(): number;
  getStateIds(): ReadonlyArray<StateId>;
  getActiveStateIds(): ReadonlyArray<StateId>;

  getTransition(id: TransitionId): Transition | undefined;
  getTransitionCount(): number;
  getTransitionIds(): ReadonlyArray<TransitionId>;

  addState(state: State): void;
  deleteState(id: StateId): void;
  
  addTransition(transition: Transition): void;
  deleteTransition(id: TransitionId): void;
}
