import { StateType, StateStatus } from '../model/State';
import type { StateId, TransitionId } from '../model/types';
import type { Transition } from '../model/Transition';
import type { State } from '../model/State';
import type { StateRegistry } from './StateRegistry';
import type { TransitionRegistry } from './TransitionRegistry';
import { SMRuntimeException } from './SMRuntimeException';

export const ROUTE_KIND = {
  None: 'none',
  NoMatch: 'noMatch',
  Terminal: 'terminal',
  Transition: 'transition',
} as const;

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

  resolve(
    fromStateId: StateId,
    status: StateStatus,
    exitCode?: string,
  ): RouteResult {
    const state = this._states.get(fromStateId);
    let result: RouteResult;
    if (!state) {
      result = { kind: ROUTE_KIND.None };
      throw new SMRuntimeException(
        `State '${fromStateId}' not found in router`,
      );
    } else if (state.type === StateType.Fork) {
      result = TransitionRouter._resolveFork(state);
    } else {
      result = this._resolveOutgoing(state, status, exitCode);
    }
    return result;
  }

  private static _resolveFork(state: State): RouteResult {
    const transitionIds = Array.from(state.outgoing);
    let result: RouteResult;
    if (transitionIds.length === 0) {
      result = { kind: ROUTE_KIND.None };
    } else {
      result = { kind: ROUTE_KIND.Transition, transitionIds };
    }
    return result;
  }

  private _resolveOutgoing(
    state: State,
    status: StateStatus,
    exitCode?: string,
  ): RouteResult {
    if (
      state.type !== StateType.Choice &&
      state.outgoing.size > 1
    ) {
      throw new SMRuntimeException(
        `State '${state.id}' (${state.type}) has ` +
          `${state.outgoing.size} outgoing transitions — ` +
          'only Fork and Choice may have multiple outgoing transitions',
      );
    }

    const outgoing = Array.from(state.outgoing)
      .map((id) => this._transitions.get(id))
      .filter(
        (transition): transition is Transition =>
          transition !== undefined,
      );

    let result: RouteResult;
    if (outgoing.length === 0) {
      result = { kind: ROUTE_KIND.None };
    } else {
      result = this._selectTransition(
        outgoing,
        status,
        exitCode,
      );
    }
    return result;
  }

  private _selectTransition(
    outgoing: Transition[],
    status: StateStatus,
    exitCode?: string,
  ): RouteResult {
    const hasQualified = outgoing.some(
      (transition) => transition.status !== undefined,
    );
    const matching = outgoing.filter((transition) =>
      TransitionRouter._matches(transition, status, exitCode),
    );

    let result: RouteResult;
    if (matching.length === 0) {
      result = hasQualified
        ? { kind: ROUTE_KIND.NoMatch }
        : { kind: ROUTE_KIND.None };
    } else {
      const first = matching[0];
      if (first === undefined) {
        result = { kind: ROUTE_KIND.None };
      } else {
        const target = this._states.get(first.toStateId);
        if (!target) {
          result = { kind: ROUTE_KIND.None };
          throw new SMRuntimeException(
            `Target state '${first.toStateId}' not found`,
          );
        } else if (target.type === StateType.Terminal) {
          result = { kind: ROUTE_KIND.Terminal, terminalId: target.id };
        } else if (target.type === StateType.Choice) {
          result = this._resolveOutgoing(
            target,
            status,
            exitCode,
          );
        } else {
          result = {
            kind: ROUTE_KIND.Transition,
            transitionIds: [first.id],
          };
        }
      }
    }
    return result;
  }

  private static _matches(
    transition: Transition,
    status: StateStatus,
    exitCode?: string,
  ): boolean {
    const statusOk =
      transition.status === undefined ||
      transition.status === StateStatus.AnyStatus ||
      transition.status === status;

    const exitCodeOk =
      transition.exitCode === undefined ||
      transition.exitCode === exitCode;

    return statusOk && exitCodeOk;
  }
}
