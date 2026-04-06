import type { StateId } from './types';
import type { IState } from './IState';
import { SMValidationException } from './exceptions';

export class StateRegistry {
  private readonly _states: Map<StateId, IState> = new Map();

  add(state: IState): void {
    if (this._states.has(state.id)) {
      throw new SMValidationException(`Duplicate state id: '${state.id}'`);
    }
    this._states.set(state.id, state);
  }

  remove(id: StateId): void {
    this._states.delete(id);
  }

  get(id: StateId): IState | undefined {
    return this._states.get(id);
  }

  count(): number {
    return this._states.size;
  }

  ids(): ReadonlyArray<StateId> {
    return Array.from(this._states.keys());
  }

  all(): ReadonlyArray<IState> {
    return Array.from(this._states.values());
  }
}
