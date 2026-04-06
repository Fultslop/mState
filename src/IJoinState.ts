import { IState } from './IState';
import type { StateStartEvent } from './types';


export interface IJoinState extends IState {
  readonly isComplete: boolean;
  onDependencyComplete(evt: StateStartEvent): void;
  reset(): void;
  readonly receivedPayloads: StateStartEvent[];
}
