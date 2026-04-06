import { SMStateType, SMStatus } from './types';
import type { SMStateId } from './types';
import { ISMState, ISMTransition } from './interfaces';
import { StateRegistry } from './StateRegistry';
import { TransitionRegistry } from './TransitionRegistry';
import { SMRuntimeException } from './exceptions';

export type RouteResult =
  | { kind: 'transition'; transitionIds: import('./types').SMTransitionId[] }
  | { kind: 'terminal'; terminalId: import('./types').SMStateId }
  | { kind: 'noMatch' }
  | { kind: 'none' };

export class TransitionRouter {
  constructor(
    private readonly _states: StateRegistry,
    private readonly _transitions: TransitionRegistry,
  ) {}

  resolve(fromStateId: SMStateId, status: SMStatus, exitCode?: string): RouteResult {
    const state = this._states.get(fromStateId);
    if (!state) {
      throw new SMRuntimeException(`State '${fromStateId}' not found in router`);
    }

    if (state.type === SMStateType.Fork) {
      return this._resolveFork(state);
    }

    return this._resolveOutgoing(state, status, exitCode);
  }

  private _resolveFork(state: ISMState): RouteResult {
    const ids = Array.from(state.outgoing);
    if (ids.length === 0) return { kind: 'none' };
    return { kind: 'transition', transitionIds: ids };
  }

  private _resolveOutgoing(state: ISMState, status: SMStatus, exitCode?: string): RouteResult {
    const outgoing = Array.from(state.outgoing)
      .map(id => this._transitions.get(id))
      .filter((t): t is ISMTransition => t !== undefined);

    if (outgoing.length === 0) return { kind: 'none' };

    const hasQualified = outgoing.some(t => t.status !== undefined);
    const matching = outgoing.filter(t => this._matches(t, status, exitCode));

    if (matching.length === 0) {
      return hasQualified ? { kind: 'noMatch' } : { kind: 'none' };
    }

    const first = matching[0];
    if (first === undefined) return { kind: 'none' };

    const target = this._states.get(first.toStateId);
    if (!target) {
      throw new SMRuntimeException(`Target state '${first.toStateId}' not found`);
    }

    if (target.type === SMStateType.Terminal) {
      return { kind: 'terminal', terminalId: target.id };
    }

    if (target.type === SMStateType.Choice) {
      return this._resolveOutgoing(target, status, exitCode);
    }

    return { kind: 'transition', transitionIds: [first.id] };
  }

  private _matches(t: ISMTransition, status: SMStatus, exitCode?: string): boolean {
    const statusOk =
      t.status === undefined ||
      t.status === SMStatus.AnyStatus ||
      t.status === status;

    const exitCodeOk =
      t.exitCode === undefined ||
      t.exitCode === exitCode;

    return statusOk && exitCodeOk;
  }
}
