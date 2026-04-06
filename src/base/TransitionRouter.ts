import { StateType, StateStatus } from '../model/State';
import type { StateId, TransitionId } from '../model/types';
import type { Transition } from '../model/Transition';
import type { State } from '../model/State';
import type { StateRegistry } from './StateRegistry';
import type { TransitionRegistry } from './TransitionRegistry';
import { SMRuntimeException } from "./SMRuntimeException";

export type RouteResult =
  | { kind: 'transition'; transitionIds: TransitionId[] }
  | { kind: 'terminal'; terminalId: StateId }
  | { kind: 'noMatch' }
  | { kind: 'none' };

export class TransitionRouter {
  constructor(
    private readonly _states: StateRegistry,
    private readonly _transitions: TransitionRegistry,
  ) {}

  resolve(fromStateId: StateId, status: StateStatus, exitCode?: string): RouteResult {
    const state = this._states.get(fromStateId);
    if (!state) {
      throw new SMRuntimeException(`State '${fromStateId}' not found in router`);
    }

    if (state.type === StateType.Fork) {
      return TransitionRouter._resolveFork(state);
    }

    return this._resolveOutgoing(state, status, exitCode);
  }

  private static _resolveFork(state: State): RouteResult {
    const ids = Array.from(state.outgoing);
    if (ids.length === 0) {
return { kind: 'none' };
}
    return { kind: 'transition', transitionIds: ids };
  }

  private _resolveOutgoing(state: State, status: StateStatus, exitCode?: string): RouteResult {
    const outgoing = Array.from(state.outgoing)
      .map((id) => this._transitions.get(id))
      .filter((t): t is Transition => t !== undefined);

    if (outgoing.length === 0) {
return { kind: 'none' };
}

    const hasQualified = outgoing.some((t) => t.status !== undefined);
    const matching = outgoing.filter((t) => TransitionRouter._matches(t, status, exitCode));

    if (matching.length === 0) {
      return hasQualified ? { kind: 'noMatch' } : { kind: 'none' };
    }

    const first = matching[0];
    if (first === undefined) {
return { kind: 'none' };
}

    const target = this._states.get(first.toStateId);
    if (!target) {
      throw new SMRuntimeException(`Target state '${first.toStateId}' not found`);
    }

    if (target.type === StateType.Terminal) {
      return { kind: 'terminal', terminalId: target.id };
    }

    if (target.type === StateType.Choice) {
      return this._resolveOutgoing(target, status, exitCode);
    }

    return { kind: 'transition', transitionIds: [first.id] };
  }

  private static _matches(t: Transition, status: StateStatus, exitCode?: string): boolean {
    const statusOk =
      t.status === undefined || t.status === StateStatus.AnyStatus || t.status === status;

    const exitCodeOk = t.exitCode === undefined || t.exitCode === exitCode;

    return statusOk && exitCodeOk;
  }
}
