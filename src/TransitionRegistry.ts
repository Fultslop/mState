import type { TransitionId } from './types';
import type { ITransition } from './ITransition';
import { SMValidationException } from './exceptions';

export class TransitionRegistry {
  private readonly _transitions: Map<TransitionId, ITransition> = new Map();

  add(transition: ITransition): void {
    if (this._transitions.has(transition.id)) {
      throw new SMValidationException(`Duplicate transition id: '${transition.id}'`);
    }
    this._transitions.set(transition.id, transition);
  }

  remove(id: TransitionId): void {
    this._transitions.delete(id);
  }

  get(id: TransitionId): ITransition | undefined {
    return this._transitions.get(id);
  }

  count(): number {
    return this._transitions.size;
  }

  ids(): ReadonlyArray<TransitionId> {
    return Array.from(this._transitions.keys());
  }

  all(): ReadonlyArray<ITransition> {
    return Array.from(this._transitions.values());
  }
}
