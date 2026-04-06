import type { State } from './State';
import type { StateStartEvent } from './types';

export interface JoinState extends State {
  readonly isComplete: boolean;
  onDependencyComplete(evt: StateStartEvent): void;
  reset(): void;
  readonly receivedPayloads: StateStartEvent[];
}
