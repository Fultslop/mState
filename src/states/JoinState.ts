import { StateType } from '@src/IState';
import type { StateStartEvent, StateId, TransitionId } from '../types';
import type { IJoinState } from '@src/IJoinState';
import { BaseState } from './BaseState';

export class JoinState extends BaseState implements IJoinState {
  private readonly _received: Map<TransitionId, StateStartEvent> = new Map();

  constructor(id: StateId) {
    super(id, StateType.Join);
  }

  get isComplete(): boolean {
    return this._received.size === this.incoming.size;
  }

  onDependencyComplete(evt: StateStartEvent): void {
    this._received.set(evt.transitionId, evt);
  }

  reset(): void {
    this._received.clear();
  }

  get receivedPayloads(): StateStartEvent[] {
    return Array.from(this._received.values());
  }
}
