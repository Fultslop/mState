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
import { TransitionRouter } from './TransitionRouter';
import { validateStateMachine } from './Validator';
import { SMRuntimeException } from "./SMRuntimeException";
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

  readonly onStateMachineStarted = new TypedEvent<StateMachineStartedEvent>();

  readonly onStateStart = new TypedEvent<StateStartEvent | StateStartEvent[]>();

  readonly onStateStopped = new TypedEvent<StateStoppedEvent>();

  readonly onStateMachineStopped = new TypedEvent<StateMachineStoppedEvent>();

  private readonly _states = new StateRegistry();

  private readonly _transitions = new TransitionRegistry();

  private readonly _router: TransitionRouter;

  private readonly _active = new Set<StateId>();

  private readonly _entryHandlers = new Map<StateType, StateEntryHandler>();

  constructor(id: StateMachineId) {
    this.id = id;
    this._router = new TransitionRouter(this._states, this._transitions);
    for (const h of [new GroupEntryHandler(), new ForkEntryHandler(), new JoinEntryHandler(), new ParallelEntryHandler()]) {
      this._entryHandlers.set(h.handledType, h);
    }
  }

  // ── ExecutionContext impl ─────────────────────────────────────────────────

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

  routeFrom(id: StateId, status: StateStatus, exitCode: string | undefined, payload: unknown): void {
    this._routeFromState(id, status, exitCode, payload);
  }

  // ── Registry access ───────────────────────────────────────────────────────

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
      for (const tId of [...group.transitionIds]) {
        if (this._transitions.get(tId)) {
this.deleteTransition(tId);
}
      }
    }
    if (state.type === StateType.Parallel) {
      const ps = state as ParallelState;
      for (const region of ps.getRegions()) {
        for (const childId of [...region.stateIds]) {
          if (this._states.get(childId)) {
this.deleteState(childId);
}
        }
      }
    }
  }

  private _deleteTouchingTransitions(state: State): void {
    for (const tId of [...state.incoming, ...state.outgoing]) {
      if (this._transitions.get(tId)) {
this.deleteTransition(tId);
}
    }
  }

  private _detachFromParent(state: State, id: StateId): void {
    if (!state.parentId) {
return;
}
    const parent = this._states.get(state.parentId);
    if (parent?.type === StateType.Group) {
      (parent as GroupState).deleteState(id);
    } else if (parent?.type === StateType.Parallel) {
      const ps = parent as ParallelState;
      const region = ps.findRegionForState(id);
      region?.deleteState(id);
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

  addTransition(t: Transition): void {
 this._transitions.add(t); 
}

  deleteTransition(id: TransitionId): void {
    const t = this._transitions.get(id);
    if (!t) {
return;
}
    this._states.get(t.fromStateId)?.outgoing.delete(id);
    this._states.get(t.toStateId)?.incoming.delete(id);
    this._detachTransitionFromParent(t);
    this._transitions.remove(id);
  }

  private _detachTransitionFromParent(t: Transition): void {
    if (!t.parentId) {
return;
}
    const parent = this._states.get(t.parentId);
    if (parent?.type === StateType.Group) {
      (parent as GroupState).deleteTransition(t.id);
    } else if (parent?.type === StateType.Parallel) {
      const ps = parent as ParallelState;
      for (const region of ps.getRegions()) {
        if (region.hasTransition(t.id)) {
          region.deleteTransition(t.id);
          break;
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

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  start(): void {
    const initials = this._states.all().filter((s) => s.type === StateType.Initial);
    if (initials.length === 0) {
      throw new SMRuntimeException('No Initial state found — call createInitial() before start()');
    }
    this.onStateMachineStarted.emit({ statemachineId: this.id, payload: undefined });
    for (const init of initials) {
      const initState = init as InitialState;
      this._routeFromState(init.id, StateStatus.None, undefined, initState.initialPayload);
    }
  }

  stop(): void {
    for (const id of this._active) {
      const s = this._states.get(id);
      if (s) {
s.stateStatus = StateStatus.Canceled;
}
    }
    this._active.clear();
    this.onStateMachineStopped.emit({
      statemachineId: this.id,
      stateStatus: StateStatus.Canceled,
      payload: undefined,
    });
  }

  onStopped(id: StateId, status: StateStatus, exitCode?: string, payload?: unknown): void {
    const state = this._states.get(id);
    if (!state) {
      throw new SMRuntimeException(`onStopped: state '${id}' not found`);
    }
    if (state.stateStatus !== StateStatus.Active) {
      throw new SMRuntimeException(
        `onStopped: state '${id}' is not Active (status: ${state.stateStatus})`,
      );
    }

    state.stateStatus = status;
    this._active.delete(id);
    this.onStateStopped.emit({ stateId: id, stateStatus: status, exitCode, payload });
    this._routeFromState(id, status, exitCode, payload);
  }

  // ── Internal routing ──────────────────────────────────────────────────────

  private _routeFromState(
    fromId: StateId,
    status: StateStatus,
    exitCode: string | undefined,
    payload: unknown,
  ): void {
    const route = this._router.resolve(fromId, status, exitCode);

    switch (route.kind) {
      case 'none':
        throw new SMRuntimeException(`No outgoing transition from state '${fromId}'`);

      case 'noMatch':
        this.onStateMachineStopped.emit({
          statemachineId: this.id,
          stateStatus: StateStatus.Error,
          payload: undefined,
        });
        break;

      case 'terminal':
        this._handleTerminalRoute(route.terminalId, status, exitCode, payload);
        break;

      case 'transition': {
        const from = this._states.get(fromId);
        if (from?.type === StateType.Fork) {
          this._handleFork(route.transitionIds, payload);
        } else {
          const tId = route.transitionIds[0];
          if (tId === undefined) {
return;
}
          const t = this._transitions.get(tId);
          if (!t) {
return;
}
          this._enterState(t.fromStateId, t.id, t.toStateId, payload);
        }
        break;
      }

      default:
        throw new SMRuntimeException(`unhandled case ${String(route)}`)
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
      return;
    }

    // Default: user-defined state — emit start event and await onStopped
    this.onStateStart.emit({ fromStateId: fromId, transitionId, toStateId: toId, payload });
  }

  private _handleFork(transitionIds: TransitionId[], payload: unknown): void {
    const events: StateStartEvent[] = [];
    for (const tId of transitionIds) {
      const t = this._transitions.get(tId);
      requiresTruthy(t, `transition '${tId}' not found in _handleFork`);
      const target = this._states.get(t.toStateId);
      requiresTruthy(target, `state '${t.toStateId}' not found in _handleFork`);
      const fork = this._states.get(t.fromStateId) as ForkState;
      const clonedPayload = fork.clonePayload ? fork.clonePayload(payload) : payload;
      target.stateStatus = StateStatus.Active;
      this._active.add(t.toStateId);
      events.push({ fromStateId: t.fromStateId, transitionId: tId, toStateId: t.toStateId, payload: clonedPayload });
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
      this.onStateStopped.emit({ stateId: group.id, stateStatus: status, exitCode, payload });
      this._routeFromState(group.id, status, exitCode, payload);
      return;
    }
    const pr = this._findParallelRegion(terminalId);
    if (pr) {
      this._onRegionTerminal(pr.parallel, pr.region, status, exitCode, payload);
      return;
    }
    this.onStateMachineStopped.emit({
      statemachineId: this.id,
      stateStatus: status,
      payload,
    });
  }

  private _findGroupOwner(terminalId: StateId): GroupState | undefined {
    for (const s of this._states.all()) {
      if (s.type === StateType.Group) {
        const g = s as GroupState;
        if (g.hasState(terminalId)) {
          return g;
        }
      }
    }
    return undefined;
  }

  private _findParallelRegion(terminalId: StateId): { parallel: ParallelState; region: Region } | undefined {
    for (const s of this._states.all()) {
      if (s.type === StateType.Parallel) {
        const ps = s as ParallelState;
        const region = ps.findRegionForTerminal(terminalId);
        if (region) {
return { parallel: ps, region };
}
      }
    }
    return undefined;
  }

  private _cancelSiblingRegions(
    region: Region,
    parallel: ParallelState,
  ): void {
    for (const r of parallel.getRegions()) {
      if (r !== region && r.status === StateStatus.Active) {
        for (const stateId of r.stateIds) {
          if (this._active.has(stateId)) {
            this._active.delete(stateId);
            const s = this._states.get(stateId);
            if (s) {
s.stateStatus = StateStatus.Canceled;
}
            r.status = StateStatus.Canceled;
            r.payload = undefined;
            this.onStateStopped.emit({ stateId, stateStatus: StateStatus.Canceled, exitCode: undefined, payload: undefined });
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
      (r) => r.status !== StateStatus.None && r.status !== StateStatus.Active,
    );
    if (!allSettled) {
return;
}

    // All regions done: complete the parallel state
    this._active.delete(parallel.id);
    let finalStatus: StateStatus;
    if (regions.some((r) => r.status === StateStatus.Error)) {
      finalStatus = StateStatus.Error;
    } else if (regions.some((r) => r.status === StateStatus.Canceled)) {
      finalStatus = StateStatus.Canceled;
    } else {
      finalStatus = StateStatus.Ok;
    }
    const aggregatedPayload = regions.map((r) => r.payload);
    parallel.stateStatus = finalStatus;
    this.onStateStopped.emit({ stateId: parallel.id, stateStatus: finalStatus, exitCode: undefined, payload: aggregatedPayload });
    this._routeFromState(parallel.id, finalStatus, exitCode, aggregatedPayload);
  }
}
