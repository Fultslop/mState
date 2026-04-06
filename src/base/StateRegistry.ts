import type { StateId } from '../model/types';
import type { State } from '../model/State';
import { SMValidationException } from "./SMValidationException";

export class StateRegistry {
  private readonly _states: Map<StateId, State> = new Map();

  add(state: State): void {
    if (this._states.has(state.id)) {
      throw new SMValidationException(`Duplicate state id: '${state.id}'`);
    }
    this._states.set(state.id, state);
  }

  remove(id: StateId): void {
    this._states.delete(id);
  }

  get(id: StateId): State | undefined {
    return this._states.get(id);
  }

  count(): number {
    return this._states.size;
  }

  ids(): ReadonlyArray<StateId> {
    return Array.from(this._states.keys());
  }

  all(): ReadonlyArray<State> {
    return Array.from(this._states.values());
  }
}
