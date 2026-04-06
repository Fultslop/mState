import type {
  StateId,
  TransitionId,
  StateStartEvent,
  StateStoppedEvent,
  StateMachineStoppedEvent,
} from '../model/types';
import type { State } from '../model/State';
import type { StateStatus } from '../model/State';
import type { Transition } from '../model/Transition';

export interface ExecutionContext {
  getState(id: StateId): State | undefined;
  getTransition(id: TransitionId): Transition | undefined;
  markActive(id: StateId): void;
  markInactive(id: StateId): void;
  emitStateStart(event: StateStartEvent | StateStartEvent[]): void;
  emitStateStopped(event: StateStoppedEvent): void;
  emitStateMachineStopped(event: StateMachineStoppedEvent): void;
  routeFrom(
    id: StateId,
    status: StateStatus,
    exitCode: string | undefined,
    payload: unknown,
  ): void;
}
