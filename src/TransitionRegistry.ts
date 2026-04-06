import type { SMTransitionId } from './types';
import type { ISMTransition } from './ISMTransition';
import { SMValidationException } from './exceptions';

export class TransitionRegistry {
  private readonly _transitions: Map<SMTransitionId, ISMTransition> = new Map();

  add(transition: ISMTransition): void {
    if (this._transitions.has(transition.id)) {
      throw new SMValidationException(`Duplicate transition id: '${transition.id}'`);
    }
    this._transitions.set(transition.id, transition);
  }

  remove(id: SMTransitionId): void {
    this._transitions.delete(id);
  }

  get(id: SMTransitionId): ISMTransition | undefined {
    return this._transitions.get(id);
  }

  count(): number {
    return this._transitions.size;
  }

  ids(): ReadonlyArray<SMTransitionId> {
    return Array.from(this._transitions.keys());
  }

  all(): ReadonlyArray<ISMTransition> {
    return Array.from(this._transitions.values());
  }
}
