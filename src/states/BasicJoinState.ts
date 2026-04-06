import { StateType } from '@src/model/State';
import type { StateStartEvent, StateId, TransitionId } from '../model/types';
import type { JoinState } from '@src/model/JoinState';
import { BaseState } from './BaseState';

export class BasicJoinState extends BaseState implements JoinState {
  private readonly _received: Map<TransitionId, StateStartEvent> = new Map();

  constructor(id: StateId, parentId?: StateId) {
    super(id, StateType.Join, undefined, parentId);
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
