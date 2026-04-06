import { IGroupState } from './IGroupState';
import { IJoinState } from './IJoinState';
import { ISMState } from './ISMState';
import { ISMTransition } from './ISMTransition';
import type { TypedEvent } from './TypedEvent';
import type { SMStateMachineId, SMStartedEvent, SMStateStartEvent, SMStateStoppedEvent, SMStoppedEvent, SMStateId, SMStatus, SMTransitionId } from './types';


export interface ISMStateMachine {
  readonly id: SMStateMachineId;

  readonly onSMStarted: TypedEvent<SMStartedEvent>;
  readonly onStateStart: TypedEvent<SMStateStartEvent | SMStateStartEvent[]>;
  readonly onStateStopped: TypedEvent<SMStateStoppedEvent>;
  readonly onSMStopped: TypedEvent<SMStoppedEvent>;

  start(): void;
  stop(): void;
  validate(): void;

  onStopped(id: SMStateId, status: SMStatus, exitCode?: string, payload?: unknown): void;

  createInitial(id: SMStateId, payload?: unknown): ISMState;
  createState(id: SMStateId, config?: Record<string, unknown>): ISMState;
  createTerminal(id: SMStateId): ISMState;
  createChoice(id: SMStateId): ISMState;
  createFork(id: SMStateId, clonePayload?: (p: unknown) => unknown): ISMState;
  createJoin(id: SMStateId): IJoinState;
  createGroup(id: SMStateId, config?: Record<string, unknown>): IGroupState;

  createTransition(
    id: SMTransitionId,
    fromId: SMStateId,
    toId: SMStateId,
    status?: SMStatus,
    exitCode?: string
  ): ISMTransition;

  getState(id: SMStateId): ISMState | undefined;
  getStateCount(): number;
  getStateIds(): ReadonlyArray<SMStateId>;
  getActiveStateIds(): ReadonlyArray<SMStateId>;

  getTransition(id: SMTransitionId): ISMTransition | undefined;
  getTransitionCount(): number;
  getTransitionIds(): ReadonlyArray<SMTransitionId>;

  addState(state: ISMState): void;
  removeState(id: SMStateId): void;
  addTransition(transition: ISMTransition): void;
  removeTransition(id: SMTransitionId): void;
}
