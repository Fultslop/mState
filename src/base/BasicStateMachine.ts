import type {
  StateMachineId,
  StateId,
  TransitionId,
  StateMachineStartedEvent,
  StateStartEvent,
  StateStoppedEvent,
  StateMachineStoppedEvent,
} from '../model/types';
import { StateStatus, StateType } from '../model/State';
import type { StateMachine } from '../model/StateMachine';
import type { State } from '../model/State';
import { TypedEvent } from '../common/TypedEvent';
import { StateRegistry } from './StateRegistry';
import { TransitionRegistry } from './TransitionRegistry';
import { TransitionRouter, ROUTE_KIND } from './TransitionRouter';
import { validateStateMachine } from './Validator';
import { SMRuntimeException } from './SMRuntimeException';
import { requiresTruthy } from '../common/requires';
import type { InitialState } from './InitialState';
import type { ForkState } from './ForkState';
import type { Transition } from '../model/Transition';
import type { GroupState } from '../model/GroupState';
import type { StateEntryHandler } from './StateEntryHandler';
import type { ExecutionContext } from './ExecutionContext';
import { GroupEntryHandler } from './GroupEntryHandler';
import { ForkEntryHandler } from './ForkEntryHandler';
import { JoinEntryHandler } from './JoinEntryHandler';
import { ParallelEntryHandler } from './ParallelEntryHandler';
import type { ParallelState } from './ParallelState';
import type { Region } from './Region';

export class BasicStateMachine implements StateMachine, ExecutionContext {
  readonly id: StateMachineId;

  readonly onStateMachineStarted =
    new TypedEvent<StateMachineStartedEvent>();

  readonly onStateStart =
    new TypedEvent<StateStartEvent | StateStartEvent[]>();

  readonly onStateStopped = new TypedEvent<StateStoppedEvent>();

  readonly onStateMachineStopped =
    new TypedEvent<StateMachineStoppedEvent>();

  private readonly _states = new StateRegistry();

  private readonly _transitions = new TransitionRegistry();

  private readonly _router: TransitionRouter;

  private readonly _active = new Set<StateId>();

  private readonly _entryHandlers = new Map<StateType, StateEntryHandler>();

  constructor(id: StateMachineId) {
    this.id = id;
    this._router = new TransitionRouter(this._states, this._transitions);
    const handlers = [
      new GroupEntryHandler(),
      new ForkEntryHandler(),
      new JoinEntryHandler(),
      new ParallelEntryHandler(),
    ];
    for (const handler of handlers) {
      this._entryHandlers.set(handler.handledType, handler);
    }
  }

  // ── ExecutionContext impl ───────────────────────────────────────────────

  markActive(id: StateId): void {
    this._active.add(id);
  }

  markInactive(id: StateId): void {
    this._active.delete(id);
  }

  emitStateStart(event: StateStartEvent | StateStartEvent[]): void {
    this.onStateStart.emit(event);
  }

  emitStateStopped(event: StateStoppedEvent): void {
    this.onStateStopped.emit(event);
  }

  emitStateMachineStopped(event: StateMachineStoppedEvent): void {
    this.onStateMachineStopped.emit(event);
  }

  routeFrom(
    id: StateId,
    status: StateStatus,
    exitCode: string | undefined,
    payload: unknown,
  ): void {
    this._routeFromState(id, status, exitCode, payload);
  }

  // ── Registry access ─────────────────────────────────────────────────────

  addState(state: State): void {
    this._states.add(state);
  }

  deleteState(id: StateId): void {
    const state = this.getState(id);
    requiresTruthy(state, `cannot find state with id ${id}.`);

    this._deleteStateChildren(state);
    this._deleteTouchingTransitions(state);
    this._detachFromParent(state, id);
    this._active.delete(id);
    this._states.remove(id);
  }

  private _deleteStateChildren(state: State): void {
    if (state.type === StateType.Group) {
      const group = state as GroupState;
      for (const childId of [...group.stateIds]) {
        this.deleteState(childId);
      }
      for (const transId of [...group.transitionIds]) {
        const existing = this._transitions.get(transId);
        if (existing) {
          this.deleteTransition(transId);
        }
      }
    }
    if (state.type === StateType.Parallel) {
      const parallel = state as ParallelState;
      for (const region of parallel.getRegions()) {
        for (const childId of [...region.stateIds]) {
          const existing = this._states.get(childId);
          if (existing) {
            this.deleteState(childId);
          }
        }
      }
    }
  }

  private _deleteTouchingTransitions(state: State): void {
    for (const transId of [...state.incoming, ...state.outgoing]) {
      const existing = this._transitions.get(transId);
      if (existing) {
        this.deleteTransition(transId);
      }
    }
  }

  private _detachFromParent(state: State, id: StateId): void {
    if (state.parentId) {
      const parent = this._states.get(state.parentId);
      if (parent?.type === StateType.Group) {
        (parent as GroupState).deleteState(id);
      } else if (parent?.type === StateType.Parallel) {
        const parallel = parent as ParallelState;
        const region = parallel.findRegionForState(id);
        region?.deleteState(id);
      }
    }
  }

  getState(id: StateId): State | undefined {
    return this._states.get(id);
  }

  getStateCount(): number {
    return this._states.count();
  }

  getStateIds(): ReadonlyArray<StateId> {
    return this._states.ids();
  }

  getActiveStateIds(): ReadonlyArray<StateId> {
    return Array.from(this._active);
  }

  addTransition(transition: Transition): void {
    this._transitions.add(transition);
  }

  deleteTransition(id: TransitionId): void {
    const transition = this._transitions.get(id);
    if (transition) {
      this._states.get(transition.fromStateId)?.outgoing.delete(id);
      this._states.get(transition.toStateId)?.incoming.delete(id);
      this._detachTransitionFromParent(transition);
      this._transitions.remove(id);
    }
  }

  private _detachTransitionFromParent(transition: Transition): void {
    if (transition.parentId) {
      const parent = this._states.get(transition.parentId);
      if (parent?.type === StateType.Group) {
        (parent as GroupState).deleteTransition(transition.id);
      } else if (parent?.type === StateType.Parallel) {
        const parallel = parent as ParallelState;
        for (const region of parallel.getRegions()) {
          if (region.hasTransition(transition.id)) {
            region.deleteTransition(transition.id);
            break;
          }
        }
      }
    }
  }

  getTransition(id: TransitionId): Transition | undefined {
    return this._transitions.get(id);
  }

  getTransitionCount(): number {
    return this._transitions.count();
  }

  getTransitionIds(): ReadonlyArray<TransitionId> {
    return this._transitions.ids();
  }

  validate(): void {
    validateStateMachine(this._states, this._transitions);
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  start(): void {
    const initials = this._states.all().filter(
      (state) => state.type === StateType.Initial,
    );
    if (initials.length === 0) {
      throw new SMRuntimeException(
        'No Initial state found — call createInitial() before start()',
      );
    }
    this.onStateMachineStarted.emit({
      statemachineId: this.id,
      payload: undefined,
    });
    for (const init of initials) {
      const initState = init as InitialState;
      this._routeFromState(
        init.id,
        StateStatus.None,
        undefined,
        initState.initialPayload,
      );
    }
  }

  stop(): void {
    for (const id of this._active) {
      const state = this._states.get(id);
      if (state) {
        state.stateStatus = StateStatus.Canceled;
      }
    }
    this._active.clear();
    this.onStateMachineStopped.emit({
      statemachineId: this.id,
      stateStatus: StateStatus.Canceled,
      payload: undefined,
    });
  }

  onStopped(
    id: StateId,
    status: StateStatus,
    exitCode?: string,
    payload?: unknown,
  ): void {
    const state = this._states.get(id);
    if (!state) {
      throw new SMRuntimeException(`onStopped: state '${id}' not found`);
    }
    if (state.stateStatus !== StateStatus.Active) {
      throw new SMRuntimeException(
        `onStopped: state '${id}' is not Active ` +
          `(status: ${state.stateStatus})`,
      );
    }

    state.stateStatus = status;
    this._active.delete(id);
    this.onStateStopped.emit({
      stateId: id,
      stateStatus: status,
      exitCode,
      payload,
    });
    this._routeFromState(id, status, exitCode, payload);
  }

  // ── Internal routing ────────────────────────────────────────────────────

  private _routeFromState(
    fromId: StateId,
    status: StateStatus,
    exitCode: string | undefined,
    payload: unknown,
  ): void {
    const route = this._router.resolve(fromId, status, exitCode);

    BasicStateMachine._handleRouteNone(route, fromId);
    this._handleRouteNoMatch(route);
    this._handleRouteTerminal(route, status, exitCode, payload);
    this._handleRouteTransition(route, fromId, payload);
    BasicStateMachine._handleRouteUnknown(route);
  }

  private static _handleRouteNone(
    route: ReturnType<TransitionRouter['resolve']>,
    fromId: StateId,
  ): void {
    if (route.kind === ROUTE_KIND.None) {
      throw new SMRuntimeException(
        `No outgoing transition from state '${fromId}'`,
      );
    }
  }

  private _handleRouteNoMatch(
    route: ReturnType<TransitionRouter['resolve']>,
  ): void {
    if (route.kind === ROUTE_KIND.NoMatch) {
      this.onStateMachineStopped.emit({
        statemachineId: this.id,
        stateStatus: StateStatus.Error,
        payload: undefined,
      });
    }
  }

  private _handleRouteTerminal(
    route: ReturnType<TransitionRouter['resolve']>,
    status: StateStatus,
    exitCode: string | undefined,
    payload: unknown,
  ): void {
    if (route.kind === ROUTE_KIND.Terminal) {
      this._handleTerminalRoute(
        route.terminalId,
        status,
        exitCode,
        payload,
      );
    }
  }

  private _handleRouteTransition(
    route: ReturnType<TransitionRouter['resolve']>,
    fromId: StateId,
    payload: unknown,
  ): void {
    if (route.kind === ROUTE_KIND.Transition) {
      const from = this._states.get(fromId);
      if (from?.type === StateType.Fork) {
        this._handleFork(route.transitionIds, payload);
      } else {
        const firstId = route.transitionIds[0];
        if (firstId !== undefined) {
          const transition = this._transitions.get(firstId);
          if (transition) {
            this._enterState(
              transition.fromStateId,
              transition.id,
              transition.toStateId,
              payload,
            );
          }
        }
      }
    }
  }

  private static _handleRouteUnknown(
    route: ReturnType<TransitionRouter['resolve']>,
  ): void {
    if (
      route.kind !== ROUTE_KIND.None &&
      route.kind !== ROUTE_KIND.NoMatch &&
      route.kind !== ROUTE_KIND.Terminal &&
      route.kind !== ROUTE_KIND.Transition
    ) {
      throw new SMRuntimeException(
        `unhandled case ${String(route)}`,
      );
    }
  }

  private _enterState(
    fromId: StateId,
    transitionId: TransitionId,
    toId: StateId,
    payload: unknown,
  ): void {
    const target = this._states.get(toId);
    if (!target) {
      throw new SMRuntimeException(`Target state '${toId}' not found`);
    }

    target.stateStatus = StateStatus.Active;
    this._active.add(toId);

    const handler = this._entryHandlers.get(target.type);
    if (handler) {
      handler.onEnter(this, fromId, transitionId, target, payload);
    } else {
      this.onStateStart.emit({
        fromStateId: fromId,
        transitionId,
        toStateId: toId,
        payload,
      });
    }
  }

  private _handleFork(
    transitionIds: TransitionId[],
    payload: unknown,
  ): void {
    const events: StateStartEvent[] = [];
    for (const transId of transitionIds) {
      const transition = this._transitions.get(transId);
      requiresTruthy(
        transition,
        `transition '${transId}' not found in _handleFork`,
      );
      const target = this._states.get(transition.toStateId);
      requiresTruthy(
        target,
        `state '${transition.toStateId}' not found in _handleFork`,
      );
      const fork = this._states.get(transition.fromStateId) as ForkState;
      const clonedPayload = fork.clonePayload
        ? fork.clonePayload(payload)
        : payload;
      target.stateStatus = StateStatus.Active;
      this._active.add(transition.toStateId);
      events.push({
        fromStateId: transition.fromStateId,
        transitionId: transId,
        toStateId: transition.toStateId,
        payload: clonedPayload,
      });
    }
    this.onStateStart.emit(events);
  }

  private _handleTerminalRoute(
    terminalId: StateId,
    status: StateStatus,
    exitCode: string | undefined,
    payload: unknown,
  ): void {
    const group = this._findGroupOwner(terminalId);
    if (group) {
      this._active.delete(group.id);
      group.stateStatus = status;
      this.onStateStopped.emit({
        stateId: group.id,
        stateStatus: status,
        exitCode,
        payload,
      });
      this._routeFromState(group.id, status, exitCode, payload);
    } else {
      const result = this._findParallelRegion(terminalId);
      if (result) {
        this._onRegionTerminal(
          result.parallel,
          result.region,
          status,
          exitCode,
          payload,
        );
      } else {
        this.onStateMachineStopped.emit({
          statemachineId: this.id,
          stateStatus: status,
          payload,
        });
      }
    }
  }

  private _findGroupOwner(
    terminalId: StateId,
  ): GroupState | undefined {
    let found: GroupState | undefined;
    for (const state of this._states.all()) {
      if (state.type === StateType.Group) {
        const group = state as GroupState;
        if (group.hasState(terminalId)) {
          found = group;
        }
      }
    }
    return found;
  }

  private _findParallelRegion(
    terminalId: StateId,
  ): { parallel: ParallelState; region: Region } | undefined {
    let found:
      | { parallel: ParallelState; region: Region }
      | undefined;
    for (const state of this._states.all()) {
      if (state.type === StateType.Parallel) {
        const parallel = state as ParallelState;
        const region = parallel.findRegionForTerminal(terminalId);
        if (region) {
          found = { parallel, region };
        }
      }
    }
    return found;
  }

  private _cancelSiblingRegions(
    region: Region,
    parallel: ParallelState,
  ): void {
    for (const sibling of parallel.getRegions()) {
      if (sibling !== region && sibling.status === StateStatus.Active) {
        for (const stateId of sibling.stateIds) {
          if (this._active.has(stateId)) {
            this._active.delete(stateId);
            const state = this._states.get(stateId);
            if (state) {
              state.stateStatus = StateStatus.Canceled;
            }
            sibling.status = StateStatus.Canceled;
            sibling.payload = undefined;
            this.onStateStopped.emit({
              stateId,
              stateStatus: StateStatus.Canceled,
              exitCode: undefined,
              payload: undefined,
            });
          }
        }
      }
    }
  }

  private _onRegionTerminal(
    parallel: ParallelState,
    region: Region,
    status: StateStatus,
    exitCode: string | undefined,
    payload: unknown,
  ): void {
    region.status = status;
    region.payload = payload;

    if (status !== StateStatus.Ok) {
      this._cancelSiblingRegions(region, parallel);
    }

    const regions = parallel.getRegions();
    const allSettled = regions.every(
      (regionItem) =>
        regionItem.status !== StateStatus.None &&
        regionItem.status !== StateStatus.Active,
    );
    if (allSettled) {
      this._completeParallel(parallel, regions, exitCode);
    }
  }

  private _completeParallel(
    parallel: ParallelState,
    regions: ReadonlyArray<Region>,
    exitCode: string | undefined,
  ): void {
    this._active.delete(parallel.id);
    let finalStatus: StateStatus;
    if (regions.some((region) => region.status === StateStatus.Error)) {
      finalStatus = StateStatus.Error;
    } else if (
      regions.some((region) => region.status === StateStatus.Canceled)
    ) {
      finalStatus = StateStatus.Canceled;
    } else {
      finalStatus = StateStatus.Ok;
    }
    const aggregatedPayload = regions.map(
      (region) => region.payload,
    );
    parallel.stateStatus = finalStatus;
    this.onStateStopped.emit({
      stateId: parallel.id,
      stateStatus: finalStatus,
      exitCode: undefined,
      payload: aggregatedPayload,
    });
    this._routeFromState(
      parallel.id,
      finalStatus,
      exitCode,
      aggregatedPayload,
    );
  }
}
