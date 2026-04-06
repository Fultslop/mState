import type { IGroupState } from './IGroupState';
import type { IJoinState } from './IJoinState';
import type { IState } from './IState';
import type { ITransition } from './ITransition';
import type { TypedEvent } from './TypedEvent';
import type {
  StateMachineId,
  StateMachineStartedEvent,
  StateStartEvent,
  StateStoppedEvent,
  StateMachineStoppedEvent,
  StateId,
  TransitionId,
} from './types';
import type { StateStatus } from './IState';

export interface IStateMachine {
  readonly id: StateMachineId;

  readonly onStateMachineStarted: TypedEvent<StateMachineStartedEvent>;
  readonly onStateStart: TypedEvent<StateStartEvent | StateStartEvent[]>;
  readonly onStateStopped: TypedEvent<StateStoppedEvent>;
  readonly onStateMachineStopped: TypedEvent<StateMachineStoppedEvent>;

  start(): void;
  stop(): void;
  validate(): void;

  onStopped(id: StateId, status: StateStatus, exitCode?: string, payload?: unknown): void;

  createInitial(id: StateId, payload?: unknown): IState;
  createState(id: StateId, config?: Record<string, unknown>): IState;
  createTerminal(id: StateId): IState;
  createChoice(id: StateId): IState;
  createFork(id: StateId, clonePayload?: (p: unknown) => unknown): IState;
  createJoin(id: StateId): IJoinState;
  createGroup(id: StateId, config?: Record<string, unknown>): IGroupState;

  createTransition(
    id: TransitionId,
    fromId: StateId,
    toId: StateId,
    status?: StateStatus,
    exitCode?: string,
  ): ITransition;

  getState(id: StateId): IState | undefined;
  getStateCount(): number;
  getStateIds(): ReadonlyArray<StateId>;
  getActiveStateIds(): ReadonlyArray<StateId>;

  getTransition(id: TransitionId): ITransition | undefined;
  getTransitionCount(): number;
  getTransitionIds(): ReadonlyArray<TransitionId>;

  addState(state: IState): void;
  removeState(id: StateId): void;
  addTransition(transition: ITransition): void;
  removeTransition(id: TransitionId): void;
}
