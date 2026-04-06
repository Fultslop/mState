import { SMStateType } from '../types';
import type { SMStateStartEvent , SMStateId, SMTransitionId } from '../types';
import type { IJoinState } from '@src/IJoinState';
import { BaseState } from './BaseState';

export class JoinState extends BaseState implements IJoinState {
  private readonly _received: Map<SMTransitionId, SMStateStartEvent> = new Map();

  constructor(id: SMStateId) { super(id, SMStateType.Join); }

  get isComplete(): boolean {
    return this._received.size === this.incoming.size;
  }

  onDependencyComplete(evt: SMStateStartEvent): void {
    this._received.set(evt.transitionId, evt);
  }

  reset(): void {
    this._received.clear();
  }

  get receivedPayloads(): SMStateStartEvent[] {
    return Array.from(this._received.values());
  }
}
