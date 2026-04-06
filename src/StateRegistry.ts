import { SMStateId } from './types';
import { ISMState } from './interfaces';
import { SMValidationException } from './exceptions';

export class StateRegistry {
  private readonly _states: Map<SMStateId, ISMState> = new Map();

  add(state: ISMState): void {
    if (this._states.has(state.id)) {
      throw new SMValidationException(`Duplicate state id: '${state.id}'`);
    }
    this._states.set(state.id, state);
  }

  remove(id: SMStateId): void {
    this._states.delete(id);
  }

  get(id: SMStateId): ISMState | undefined {
    return this._states.get(id);
  }

  count(): number {
    return this._states.size;
  }

  ids(): ReadonlyArray<SMStateId> {
    return Array.from(this._states.keys());
  }

  all(): ReadonlyArray<ISMState> {
    return Array.from(this._states.values());
  }
}
