import type { TransitionId } from '../model/types';
import type { Transition } from '../model/Transition';
import { SMValidationException } from './exceptions';

export class TransitionRegistry {
  private readonly _transitions: Map<TransitionId, Transition> = new Map();

  add(transition: Transition): void {
    if (this._transitions.has(transition.id)) {
      throw new SMValidationException(`Duplicate transition id: '${transition.id}'`);
    }
    this._transitions.set(transition.id, transition);
  }

  remove(id: TransitionId): void {
    this._transitions.delete(id);
  }

  get(id: TransitionId): Transition | undefined {
    return this._transitions.get(id);
  }

  count(): number {
    return this._transitions.size;
  }

  ids(): ReadonlyArray<TransitionId> {
    return Array.from(this._transitions.keys());
  }

  all(): ReadonlyArray<Transition> {
    return Array.from(this._transitions.values());
  }
}
