import { ISMState } from './ISMState';
import type { SMStateStartEvent } from './types';


export interface IJoinState extends ISMState {
  readonly isComplete: boolean;
  onDependencyComplete(evt: SMStateStartEvent): void;
  reset(): void;
  readonly receivedPayloads: SMStateStartEvent[];
}
