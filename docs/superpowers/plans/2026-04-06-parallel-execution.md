# Parallel Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `ParallelState` that runs multiple independent regions concurrently, completing when all regions finish and canceling siblings on any region failure.

**Architecture:** Refactor `BasicStateMachine._enterState` from an if/else chain to a handler-map dispatch before adding parallel logic. Each complex state type (Group, Fork, Join, Parallel) gets its own `StateEntryHandler` class. Parallel region completion is detected inside the existing `_routeFromState` terminal case by a new `_findParallelRegion` helper. No separate exit-hook infrastructure is needed.

**Tech Stack:** TypeScript, Jest (via `npm test`), path alias `@src/` maps to `src/`. Linting via ESLint (`npm run lint`).

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `src/model/StateContainer.ts` | Shared interface for containers of states/transitions |
| Create | `src/base/ExecutionContext.ts` | Narrow SM interface exposed to entry handlers |
| Create | `src/base/StateEntryHandler.ts` | Entry handler contract |
| Create | `src/base/GroupEntryHandler.ts` | Group entry logic (migrated from `BasicStateMachine`) |
| Create | `src/base/ForkEntryHandler.ts` | Fork entry logic (migrated) |
| Create | `src/base/JoinEntryHandler.ts` | Join entry logic (migrated) |
| Create | `src/base/Region.ts` | Region with implicit terminal + StateContainer impl |
| Create | `src/base/ParallelState.ts` | ParallelState: owns regions, delegates addState to SM |
| Create | `src/base/ParallelEntryHandler.ts` | Activates all regions on parallel entry |
| Create | `test/integration/011.parallel_execution.test.ts` | Parallel execution integration tests |
| Modify | `src/model/State.ts` | Add `Parallel = 'parallel'` to `StateType` |
| Modify | `src/model/GroupState.ts` | `extends StateContainer` |
| Modify | `src/base/BasicStateMachine.ts` | Handler map dispatch; parallel terminal case; cascade delete |
| Modify | `src/base/StateMachineBuilder.ts` | `createParallel` method |
| Modify | `src/base/Validator.ts` | 5 new parallel validation rules |
| Modify | `src/index.ts` | Export `Region`, `ParallelState` |

**Design decision — `Region` initial/terminal:** `Region` creates one implicit `TerminalState` (accessible as `region.terminal`). The region's *entry* point is whichever `StateType.Initial` member the user adds to the region — `ParallelEntryHandler` finds it by scanning `region.stateIds` exactly as `_startGroup` does for groups. No implicit `region.initial` property is created; the user provides it via `builder.createInitial` + `region.addState`.

---

## Task 1: `StateContainer` interface

**Files:**
- Create: `src/model/StateContainer.ts`

- [ ] **Step 1: Create `StateContainer`**

```ts
// src/model/StateContainer.ts
import type { State } from './State';
import type { Transition } from './Transition';
import type { StateId, TransitionId } from './types';

export interface StateContainer {
  readonly stateIds: Set<StateId>;
  readonly transitionIds: Set<TransitionId>;
  hasState(id: StateId): boolean;
  addState(state: State): void;
  deleteState(id: StateId): void;
  hasTransition(id: TransitionId): boolean;
  addTransition(t: Transition): void;
  deleteTransition(id: TransitionId): void;
}
```

- [ ] **Step 2: Verify compilation**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/model/StateContainer.ts
git commit -m "feat: extract StateContainer interface"
```

---

## Task 2: `GroupState` extends `StateContainer`

**Files:**
- Modify: `src/model/GroupState.ts`

`BasicGroupState` already implements all methods — this is interface-only.

- [ ] **Step 1: Update `GroupState`**

Replace the entire file:

```ts
// src/model/GroupState.ts
import type { StateContainer } from './StateContainer';
import type { State } from './State';

export interface GroupState extends State, StateContainer {}
```

- [ ] **Step 2: Run tests — must still pass**

```bash
npm test
```
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/model/GroupState.ts
git commit -m "feat: GroupState extends StateContainer"
```

---

## Task 3: `ExecutionContext` and `StateEntryHandler` interfaces

**Files:**
- Create: `src/base/ExecutionContext.ts`
- Create: `src/base/StateEntryHandler.ts`

- [ ] **Step 1: Create `ExecutionContext`**

```ts
// src/base/ExecutionContext.ts
import type { StateId, TransitionId, StateStartEvent, StateStoppedEvent, StateMachineStoppedEvent } from '../model/types';
import type { State } from '../model/State';
import type { StateStatus } from '../model/State';
import type { Transition } from '../model/Transition';

export interface ExecutionContext {
  getState(id: StateId): State | undefined;
  getTransition(id: TransitionId): Transition | undefined;
  markActive(id: StateId): void;
  markInactive(id: StateId): void;
  emitStateStart(event: StateStartEvent | StateStartEvent[]): void;
  emitStateStopped(event: StateStoppedEvent): void;
  emitStateMachineStopped(event: StateMachineStoppedEvent): void;
  routeFrom(id: StateId, status: StateStatus, exitCode: string | undefined, payload: unknown): void;
}
```

- [ ] **Step 2: Create `StateEntryHandler`**

```ts
// src/base/StateEntryHandler.ts
import type { StateType } from '../model/State';
import type { State } from '../model/State';
import type { StateId, TransitionId } from '../model/types';
import type { ExecutionContext } from './ExecutionContext';

export interface StateEntryHandler {
  readonly handledType: StateType;
  onEnter(
    ctx: ExecutionContext,
    fromId: StateId,
    transitionId: TransitionId,
    target: State,
    payload: unknown,
  ): void;
}
```

- [ ] **Step 3: Verify compilation**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/base/ExecutionContext.ts src/base/StateEntryHandler.ts
git commit -m "feat: ExecutionContext and StateEntryHandler interfaces"
```

---

## Task 4: `GroupEntryHandler`

**Files:**
- Create: `src/base/GroupEntryHandler.ts`

Migrates `_startGroup` from `BasicStateMachine`. The group's `onStateStart` event is emitted by the handler (currently emitted in `_enterState` before calling `_startGroup`).

- [ ] **Step 1: Create `GroupEntryHandler`**

```ts
// src/base/GroupEntryHandler.ts
import { StateType, StateStatus } from '../model/State';
import type { State } from '../model/State';
import type { StateId, TransitionId } from '../model/types';
import type { ExecutionContext } from './ExecutionContext';
import type { StateEntryHandler } from './StateEntryHandler';
import type { GroupState } from '../model/GroupState';
import type { InitialState } from './InitialState';
import { SMRuntimeException } from './SMRuntimeException';

export class GroupEntryHandler implements StateEntryHandler {
  readonly handledType = StateType.Group;

  onEnter(ctx: ExecutionContext, fromId: StateId, transitionId: TransitionId, target: State, payload: unknown): void {
    ctx.emitStateStart({ fromStateId: fromId, transitionId, toStateId: target.id, payload });

    const group = target as GroupState;
    const initId = Array.from(group.stateIds).find(
      (id) => ctx.getState(id)?.type === StateType.Initial,
    );
    if (!initId) throw new SMRuntimeException(`Group '${group.id}' has no Initial member state`);

    const groupInit = ctx.getState(initId) as InitialState;
    const initPayload = groupInit.initialPayload ?? payload;
    ctx.routeFrom(initId, StateStatus.None, undefined, initPayload);
  }
}
```

- [ ] **Step 2: Verify compilation**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/base/GroupEntryHandler.ts
git commit -m "feat: GroupEntryHandler (migrated from BasicStateMachine)"
```

---

## Task 5: `ForkEntryHandler` and `JoinEntryHandler`

**Files:**
- Create: `src/base/ForkEntryHandler.ts`
- Create: `src/base/JoinEntryHandler.ts`

- [ ] **Step 1: Create `ForkEntryHandler`**

```ts
// src/base/ForkEntryHandler.ts
import { StateType, StateStatus } from '../model/State';
import type { State } from '../model/State';
import type { StateId, TransitionId } from '../model/types';
import type { ExecutionContext } from './ExecutionContext';
import type { StateEntryHandler } from './StateEntryHandler';

export class ForkEntryHandler implements StateEntryHandler {
  readonly handledType = StateType.Fork;

  onEnter(ctx: ExecutionContext, _fromId: StateId, _transitionId: TransitionId, target: State, payload: unknown): void {
    // Fork is a pseudo-state: unmark active and route through it immediately
    ctx.markInactive(target.id);
    target.stateStatus = StateStatus.None;
    ctx.routeFrom(target.id, StateStatus.None, undefined, payload);
  }
}
```

- [ ] **Step 2: Create `JoinEntryHandler`**

```ts
// src/base/JoinEntryHandler.ts
import { StateType, StateStatus } from '../model/State';
import type { State } from '../model/State';
import type { StateId, TransitionId } from '../model/types';
import type { ExecutionContext } from './ExecutionContext';
import type { StateEntryHandler } from './StateEntryHandler';
import type { JoinState } from '../model/JoinState';

export class JoinEntryHandler implements StateEntryHandler {
  readonly handledType = StateType.Join;

  onEnter(ctx: ExecutionContext, fromId: StateId, transitionId: TransitionId, target: State, payload: unknown): void {
    const join = target as JoinState;
    join.onDependencyComplete({ fromStateId: fromId, transitionId, toStateId: target.id, payload });
    ctx.markInactive(target.id);
    target.stateStatus = StateStatus.None;

    if (join.isComplete) {
      const collected = join.receivedPayloads;
      join.reset();
      ctx.routeFrom(join.id, StateStatus.Ok, undefined, collected);
    }
  }
}
```

- [ ] **Step 3: Verify compilation**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/base/ForkEntryHandler.ts src/base/JoinEntryHandler.ts
git commit -m "feat: ForkEntryHandler and JoinEntryHandler"
```

---

## Task 6: Refactor `BasicStateMachine` to use handler map

**Files:**
- Modify: `src/base/BasicStateMachine.ts`

Replace the if/else type chain in `_enterState` with a handler map. Wire in the three handlers from Tasks 4–5. All existing tests must still pass — behaviour is unchanged.

- [ ] **Step 1: Run existing tests first, note baseline**

```bash
npm test
```
Expected: all pass. Note the count.

- [ ] **Step 2: Rewrite `BasicStateMachine`**

Replace the full file:

```ts
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
    for (const h of [new GroupEntryHandler(), new ForkEntryHandler(), new JoinEntryHandler()]) {
      this._entryHandlers.set(h.handledType, h);
    }
  }

  // ── ExecutionContext impl ─────────────────────────────────────────────────

  markActive(id: StateId): void { this._active.add(id); }
  markInactive(id: StateId): void { this._active.delete(id); }
  emitStateStart(event: StateStartEvent | StateStartEvent[]): void { this.onStateStart.emit(event); }
  emitStateStopped(event: StateStoppedEvent): void { this.onStateStopped.emit(event); }
  emitStateMachineStopped(event: StateMachineStoppedEvent): void { this.onStateMachineStopped.emit(event); }

  // ── Registry access ───────────────────────────────────────────────────────

  addState(state: State): void { this._states.add(state); }

  deleteState(id: StateId): void {
    const state = this.getState(id);
    requiresTruthy(state, `cannot find state with id ${id}.`);

    if (state.type === StateType.Group) {
      const group = state as GroupState;
      for (const childId of [...group.stateIds]) this.deleteState(childId);
      for (const tId of [...group.transitionIds]) {
        if (this._transitions.get(tId)) this.deleteTransition(tId);
      }
    }

    for (const tId of [...state.incoming, ...state.outgoing]) {
      if (this._transitions.get(tId)) this.deleteTransition(tId);
    }

    if (state.parentId) {
      const parent = this._states.get(state.parentId);
      if (parent?.type === StateType.Group) (parent as GroupState).deleteState(id);
    }

    this._active.delete(id);
    this._states.remove(id);
  }

  getState(id: StateId): State | undefined { return this._states.get(id); }
  getStateCount(): number { return this._states.count(); }
  getStateIds(): ReadonlyArray<StateId> { return this._states.ids(); }
  getActiveStateIds(): ReadonlyArray<StateId> { return Array.from(this._active); }

  addTransition(t: Transition): void { this._transitions.add(t); }

  deleteTransition(id: TransitionId): void {
    const t = this._transitions.get(id);
    if (!t) return;
    this._states.get(t.fromStateId)?.outgoing.delete(id);
    this._states.get(t.toStateId)?.incoming.delete(id);
    if (t.parentId) {
      const parent = this._states.get(t.parentId);
      if (parent?.type === StateType.Group) (parent as GroupState).deleteTransition(id);
    }
    this._transitions.remove(id);
  }

  getTransition(id: TransitionId): Transition | undefined { return this._transitions.get(id); }
  getTransitionCount(): number { return this._transitions.count(); }
  getTransitionIds(): ReadonlyArray<TransitionId> { return this._transitions.ids(); }

  validate(): void { validateStateMachine(this._states, this._transitions); }

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
      if (s) s.stateStatus = StateStatus.Canceled;
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
    if (!state) throw new SMRuntimeException(`onStopped: state '${id}' not found`);
    if (state.stateStatus !== StateStatus.Active) {
      throw new SMRuntimeException(`onStopped: state '${id}' is not Active (status: ${state.stateStatus})`);
    }

    state.stateStatus = status;
    this._active.delete(id);
    this.onStateStopped.emit({ stateId: id, stateStatus: status, exitCode, payload });
    this._routeFromState(id, status, exitCode, payload);
  }

  // ── Internal routing ──────────────────────────────────────────────────────

  routeFrom(id: StateId, status: StateStatus, exitCode: string | undefined, payload: unknown): void {
    this._routeFromState(id, status, exitCode, payload);
  }

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

      case 'terminal': {
        const group = this._findGroupOwner(route.terminalId);
        if (group) {
          this._active.delete(group.id);
          group.stateStatus = status;
          this.onStateStopped.emit({ stateId: group.id, stateStatus: status, exitCode, payload });
          this._routeFromState(group.id, status, exitCode, payload);
        } else {
          this.onStateMachineStopped.emit({
            statemachineId: this.id,
            stateStatus: status,
            payload,
          });
        }
        break;
      }

      case 'transition': {
        const from = this._states.get(fromId);
        if (from?.type === StateType.Fork) {
          this._handleFork(route.transitionIds, payload);
        } else {
          const tId = route.transitionIds[0];
          if (tId === undefined) return;
          const t = this._transitions.get(tId);
          if (!t) return;
          this._enterState(t.fromStateId, t.id, t.toStateId, payload, status, exitCode);
        }
        break;
      }

      default:
        throw new SMRuntimeException(`unhandled case ${String(route)}`);
    }
  }

  private _enterState(
    fromId: StateId,
    transitionId: TransitionId,
    toId: StateId,
    payload: unknown,
    _status: StateStatus = StateStatus.None,
    _exitCode?: string,
  ): void {
    const target = this._states.get(toId);
    if (!target) throw new SMRuntimeException(`Target state '${toId}' not found`);

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

  private _findGroupOwner(terminalId: StateId): GroupState | undefined {
    for (const s of this._states.all()) {
      if (s.type === StateType.Group) {
        const g = s as GroupState;
        if (g.hasState(terminalId)) return g;
      }
    }
    return undefined;
  }
}
```

- [ ] **Step 3: Run all tests — must match baseline**

```bash
npm test
```
Expected: same pass count as before.

- [ ] **Step 4: Commit**

```bash
git add src/base/BasicStateMachine.ts
git commit -m "refactor: BasicStateMachine uses StateEntryHandler map"
```

---

## Task 7: `Region` class

**Files:**
- Create: `src/base/Region.ts`
- Create: `test/states.test.ts` additions (add to existing `test/states.test.ts`)

`Region` creates one implicit `TerminalState` (stored as `region.terminal`) and registers it with the SM via an injected callback. The user provides the entry `InitialState` by adding it to the region.

- [ ] **Step 1: Write failing test**

Add to `test/states.test.ts`:

```ts
import { Region } from '@src/base/Region';
import { BasicStateMachine } from '@src/base/BasicStateMachine';
import { StateType, StateStatus } from '@src/model/State';
import type { StateMachineId, StateId } from '@src/model/types';

const smid = (s: string) => s as StateMachineId;
const sid  = (s: string) => s as StateId;

describe('Region', () => {
  it('creates an implicit terminal state registered in the SM', () => {
    const sm = new BasicStateMachine(smid('test'));
    const region = new Region('r1', (s) => sm.addState(s), sid('parallel1'));
    expect(sm.getState(region.terminal.id)).toBeDefined();
    expect(region.terminal.type).toBe(StateType.Terminal);
  });

  it('terminal parentId is the parallel state id', () => {
    const sm = new BasicStateMachine(smid('test'));
    const region = new Region('r1', (s) => sm.addState(s), sid('parallel1'));
    expect(region.terminal.parentId).toBe(sid('parallel1'));
  });

  it('addState sets parentId on the state', () => {
    const sm = new BasicStateMachine(smid('test'));
    const region = new Region('r1', (s) => sm.addState(s), sid('parallel1'));
    const fakeState = { id: sid('s1'), parentId: undefined } as any;
    region.addState(fakeState);
    expect(fakeState.parentId).toBe(sid('parallel1'));
    expect(region.stateIds.has(sid('s1'))).toBe(true);
  });

  it('starts with status None', () => {
    const sm = new BasicStateMachine(smid('test'));
    const region = new Region('r1', (s) => sm.addState(s), sid('parallel1'));
    expect(region.status).toBe(StateStatus.None);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest test/states.test.ts --testNamePattern="Region" 2>&1 | tail -5
```
Expected: FAIL — `Region` not found.

- [ ] **Step 3: Create `Region`**

```ts
// src/base/Region.ts
import { StateStatus } from '../model/State';
import type { State } from '../model/State';
import type { StateId, TransitionId } from '../model/types';
import type { Transition } from '../model/Transition';
import type { StateContainer } from '../model/StateContainer';
import { TerminalState } from './TerminalState';

export class Region implements StateContainer {
  readonly id: string;
  readonly stateIds: Set<StateId> = new Set();
  readonly transitionIds: Set<TransitionId> = new Set();
  readonly terminal: TerminalState;

  status: StateStatus = StateStatus.None;
  payload: unknown = undefined;

  private readonly _parentStateId: StateId;

  constructor(id: string, addState: (s: State) => void, parentStateId: StateId) {
    this.id = id;
    this._parentStateId = parentStateId;
    this.terminal = new TerminalState(`${id}.__terminal` as StateId, parentStateId);
    addState(this.terminal);
    this.stateIds.add(this.terminal.id);
  }

  hasState(id: StateId): boolean { return this.stateIds.has(id); }

  addState(state: State): void {
    this.stateIds.add(state.id);
    state.parentId = this._parentStateId;
  }

  deleteState(id: StateId): void { this.stateIds.delete(id); }

  hasTransition(id: TransitionId): boolean { return this.transitionIds.has(id); }

  addTransition(t: Transition): void {
    this.transitionIds.add(t.id);
    t.parentId = this._parentStateId;
  }

  deleteTransition(id: TransitionId): void { this.transitionIds.delete(id); }
}
```

- [ ] **Step 4: Run test — must pass**

```bash
npx jest test/states.test.ts --testNamePattern="Region"
```
Expected: PASS.

- [ ] **Step 5: Run all tests**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/base/Region.ts test/states.test.ts
git commit -m "feat: Region class with implicit terminal"
```

---

## Task 8: `StateType.Parallel` and `ParallelState`

**Files:**
- Modify: `src/model/State.ts`
- Create: `src/base/ParallelState.ts`

- [ ] **Step 1: Add `Parallel` to `StateType`**

In `src/model/State.ts`, add one line to the enum:

```ts
export enum StateType {
  Initial = 'initial',
  Terminal = 'terminal',
  Choice = 'choice',
  Fork = 'fork',
  Join = 'join',
  Group = 'group',
  UserDefined = 'userDefined',
  Parallel = 'parallel',   // ← add this
}
```

- [ ] **Step 2: Write failing test for `ParallelState`**

Add to `test/states.test.ts`:

```ts
import { ParallelState } from '@src/base/ParallelState';
import { StateType } from '@src/model/State';

describe('ParallelState', () => {
  it('has type Parallel', () => {
    const sm = new BasicStateMachine(smid('test'));
    const ps = new ParallelState(sid('p1'), (s) => sm.addState(s));
    expect(ps.type).toBe(StateType.Parallel);
  });

  it('createRegion returns a Region with terminal in SM', () => {
    const sm = new BasicStateMachine(smid('test'));
    const ps = new ParallelState(sid('p1'), (s) => sm.addState(s));
    const r = ps.createRegion('r1');
    expect(r.terminal).toBeDefined();
    expect(sm.getState(r.terminal.id)).toBeDefined();
  });

  it('getRegions returns all created regions', () => {
    const sm = new BasicStateMachine(smid('test'));
    const ps = new ParallelState(sid('p1'), (s) => sm.addState(s));
    ps.createRegion('r1');
    ps.createRegion('r2');
    expect(ps.getRegions()).toHaveLength(2);
  });

  it('payloadClone is stored', () => {
    const sm = new BasicStateMachine(smid('test'));
    const clone = (p: unknown) => ({ ...p as object });
    const ps = new ParallelState(sid('p1'), (s) => sm.addState(s), clone);
    expect(ps.payloadClone).toBe(clone);
  });
});
```

- [ ] **Step 3: Run test — verify fails**

```bash
npx jest test/states.test.ts --testNamePattern="ParallelState" 2>&1 | tail -5
```

- [ ] **Step 4: Create `ParallelState`**

```ts
// src/base/ParallelState.ts
import { StateType } from '../model/State';
import type { State } from '../model/State';
import type { StateId } from '../model/types';
import { BaseState } from './BasicState';
import { Region } from './Region';

export class ParallelState extends BaseState {
  readonly payloadClone: ((payload: unknown) => unknown) | undefined;
  private readonly _regions: Region[] = [];
  private readonly _addState: (s: State) => void;

  constructor(
    id: StateId,
    addState: (s: State) => void,
    payloadClone?: (payload: unknown) => unknown,
    parentId?: StateId,
  ) {
    super(id, StateType.Parallel, undefined, parentId);
    this._addState = addState;
    this.payloadClone = payloadClone;
  }

  createRegion(id: string): Region {
    const region = new Region(id, this._addState, this.id);
    this._regions.push(region);
    return region;
  }

  getRegion(id: string): Region | undefined {
    return this._regions.find((r) => r.id === id);
  }

  getRegions(): ReadonlyArray<Region> {
    return this._regions;
  }

  findRegionForState(stateId: StateId): Region | undefined {
    return this._regions.find((r) => r.hasState(stateId));
  }

  findRegionForTerminal(terminalId: StateId): Region | undefined {
    return this._regions.find((r) => r.terminal.id === terminalId);
  }
}
```

- [ ] **Step 5: Run tests — all pass**

```bash
npm test
```

- [ ] **Step 6: Commit**

```bash
git add src/model/State.ts src/base/ParallelState.ts test/states.test.ts
git commit -m "feat: ParallelState and StateType.Parallel"
```

---

## Task 9: `StateMachineBuilder.createParallel`

**Files:**
- Modify: `src/base/StateMachineBuilder.ts`

- [ ] **Step 1: Write failing test**

Add to `test/StateMachine.test.ts` inside the describe block:

```ts
import { ParallelState } from '@src/base/ParallelState';

it('createParallel adds a Parallel state', () => {
  const sm = new BasicStateMachine(smid('test'));
  const builder = new StateMachineBuilder(sm);
  const ps = builder.createParallel(sid('p1'));
  expect(ps.type).toBe(StateType.Parallel);
  expect(sm.getState(sid('p1'))).toBe(ps);
});

it('createParallel stores payloadClone', () => {
  const sm = new BasicStateMachine(smid('test'));
  const builder = new StateMachineBuilder(sm);
  const clone = (p: unknown) => p;
  const ps = builder.createParallel(sid('p1'), clone);
  expect((ps as ParallelState).payloadClone).toBe(clone);
});
```

- [ ] **Step 2: Run test — verify fails**

```bash
npx jest test/StateMachine.test.ts --testNamePattern="createParallel" 2>&1 | tail -5
```

- [ ] **Step 3: Add `createParallel` to `StateMachineBuilder`**

Add this import at the top of `src/base/StateMachineBuilder.ts`:

```ts
import { ParallelState } from './ParallelState';
```

Add this method to the class:

```ts
createParallel(id: StateId, payloadClone?: (p: unknown) => unknown, parent?: StateId): ParallelState {
  const s = new ParallelState(id, (state) => this._stateMachine.addState(state), payloadClone, parent);
  this._stateMachine.addState(s);
  return s;
}
```

- [ ] **Step 4: Run all tests**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/base/StateMachineBuilder.ts test/StateMachine.test.ts
git commit -m "feat: StateMachineBuilder.createParallel"
```

---

## Task 10: `ParallelEntryHandler`

**Files:**
- Create: `src/base/ParallelEntryHandler.ts`
- Modify: `src/base/BasicStateMachine.ts` (register handler in constructor)

On entry to a parallel state, emit `onStateStart` for the parallel state itself, then start all regions concurrently by routing from each region's initial state.

- [ ] **Step 1: Create `ParallelEntryHandler`**

```ts
// src/base/ParallelEntryHandler.ts
import { StateType, StateStatus } from '../model/State';
import type { State } from '../model/State';
import type { StateId, TransitionId } from '../model/types';
import type { ExecutionContext } from './ExecutionContext';
import type { StateEntryHandler } from './StateEntryHandler';
import type { ParallelState } from './ParallelState';
import { SMRuntimeException } from './SMRuntimeException';
import type { InitialState } from './InitialState';

export class ParallelEntryHandler implements StateEntryHandler {
  readonly handledType = StateType.Parallel;

  onEnter(ctx: ExecutionContext, fromId: StateId, transitionId: TransitionId, target: State, payload: unknown): void {
    const parallel = target as ParallelState;
    ctx.emitStateStart({ fromStateId: fromId, transitionId, toStateId: target.id, payload });

    for (const region of parallel.getRegions()) {
      region.status = StateStatus.Active;

      const initId = Array.from(region.stateIds).find(
        (id) => ctx.getState(id)?.type === StateType.Initial,
      );
      if (!initId) {
        throw new SMRuntimeException(`Region '${region.id}' in parallel '${parallel.id}' has no Initial state`);
      }

      const regionInit = ctx.getState(initId) as InitialState;
      const regionPayload = parallel.payloadClone ? parallel.payloadClone(payload) : payload;
      const initPayload = regionInit.initialPayload ?? regionPayload;
      ctx.routeFrom(initId, StateStatus.None, undefined, initPayload);
    }
  }
}
```

- [ ] **Step 2: Register `ParallelEntryHandler` in `BasicStateMachine` constructor**

In `src/base/BasicStateMachine.ts`, add import:

```ts
import { ParallelEntryHandler } from './ParallelEntryHandler';
```

In the constructor, add to the handler list:

```ts
for (const h of [
  new GroupEntryHandler(),
  new ForkEntryHandler(),
  new JoinEntryHandler(),
  new ParallelEntryHandler(),
]) {
  this._entryHandlers.set(h.handledType, h);
}
```

- [ ] **Step 3: Verify compilation**

```bash
npm run typecheck
```

- [ ] **Step 4: Run all tests**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add src/base/ParallelEntryHandler.ts src/base/BasicStateMachine.ts
git commit -m "feat: ParallelEntryHandler activates regions on entry"
```

---

## Task 11: Parallel terminal routing and region completion

**Files:**
- Modify: `src/base/BasicStateMachine.ts`

When a state inside a region transitions to `region.terminal`, `_routeFromState` receives a `'terminal'` result. The current `_findGroupOwner` won't find it (it's not in a group). Add `_findParallelRegion` to detect this and delegate to a new `_onRegionTerminal` method.

`_onRegionTerminal` marks the region done, cancels siblings on non-Ok status, and when all regions are settled routes the parallel state.

- [ ] **Step 1: Write failing integration test**

Create `test/integration/011.parallel_execution.test.ts`:

```ts
import { BasicStateMachine } from '@src/base/BasicStateMachine';
import { StateMachineBuilder } from '@src/base/StateMachineBuilder';
import { StateStatus, StateType } from '@src/model/State';
import type { StateMachineId, StateId, TransitionId, StateStartEvent, StateStoppedEvent, StateMachineStoppedEvent } from '@src/model/types';

const smid = (s: string) => s as StateMachineId;
const sid  = (s: string) => s as StateId;
const tid  = (s: string) => s as TransitionId;

function buildParallelSM() {
  const sm      = new BasicStateMachine(smid('parallelExample'));
  const builder = new StateMachineBuilder(sm);

  const initRoot      = builder.createInitial(sid('initRoot'));
  const parallelGroup = builder.createParallel(sid('parallelGroup'));
  const terminal      = builder.createTerminal(sid('terminal'));

  builder.createTransition(tid('t0'), initRoot.id, parallelGroup.id);
  builder.createTransition(tid('t1'), parallelGroup.id, terminal.id);

  const region1 = parallelGroup.createRegion('region1');
  const init1   = builder.createInitial(sid('init1'));
  const exec1   = builder.createState(sid('execute1'));
  const r1t1 = builder.createTransition(tid('r1t1'), init1.id, exec1.id);
  const r1t2 = builder.createTransition(tid('r1t2'), exec1.id, region1.terminal.id);
  region1.addState(init1);
  region1.addState(exec1);
  region1.addTransition(r1t1);
  region1.addTransition(r1t2);

  const region2 = parallelGroup.createRegion('region2');
  const init2   = builder.createInitial(sid('init2'));
  const exec2   = builder.createState(sid('execute2'));
  const r2t1 = builder.createTransition(tid('r2t1'), init2.id, exec2.id);
  const r2t2 = builder.createTransition(tid('r2t2'), exec2.id, region2.terminal.id);
  region2.addState(init2);
  region2.addState(exec2);
  region2.addTransition(r2t1);
  region2.addTransition(r2t2);

  return sm;
}

describe('spec 011 — parallel execution', () => {
  it('activates both regions on start', () => {
    const sm = buildParallelSM();
    sm.start();
    const active = sm.getActiveStateIds();
    expect(active).toContain(sid('execute1'));
    expect(active).toContain(sid('execute2'));
    expect(active).toContain(sid('parallelGroup'));
  });

  it('happy path: both Ok → machine stops Ok with aggregated payload', () => {
    const sm = buildParallelSM();
    const smStopped: StateMachineStoppedEvent[] = [];
    const stateStopped: StateStoppedEvent[] = [];
    sm.onStateMachineStopped.add(e => smStopped.push(e));
    sm.onStateStopped.add(e => stateStopped.push(e));

    sm.start();
    sm.onStopped(sid('execute1'), StateStatus.Ok, undefined, 'result1');
    expect(sm.getActiveStateIds()).toContain(sid('execute2'));  // still running

    sm.onStopped(sid('execute2'), StateStatus.Ok, undefined, 'result2');

    const parallelStopped = stateStopped.find(e => e.stateId === sid('parallelGroup'));
    expect(parallelStopped?.stateStatus).toBe(StateStatus.Ok);
    expect(parallelStopped?.payload).toEqual(['result1', 'result2']);
    expect(smStopped[0]?.stateStatus).toBe(StateStatus.Ok);
  });

  it('region failure: one Error cancels siblings and exits parallel with Error', () => {
    const sm = buildParallelSM();
    const stateStopped: StateStoppedEvent[] = [];
    sm.onStateStopped.add(e => stateStopped.push(e));

    sm.start();
    sm.onStopped(sid('execute1'), StateStatus.Error);

    const exec2Stopped = stateStopped.find(e => e.stateId === sid('execute2'));
    expect(exec2Stopped?.stateStatus).toBe(StateStatus.Canceled);

    const parallelStopped = stateStopped.find(e => e.stateId === sid('parallelGroup'));
    expect(parallelStopped?.stateStatus).toBe(StateStatus.Error);
  });

  it('emits onStateStart with array covering parallel + both region starts', () => {
    const sm = buildParallelSM();
    const startEvents: (StateStartEvent | StateStartEvent[])[] = [];
    sm.onStateStart.add(e => startEvents.push(e));

    sm.start();

    const parallelStart = startEvents.find(e => !Array.isArray(e) && e.toStateId === sid('parallelGroup'));
    expect(parallelStart).toBeDefined();
    const exec1Start = startEvents.find(e => !Array.isArray(e) && e.toStateId === sid('execute1'));
    expect(exec1Start).toBeDefined();
    const exec2Start = startEvents.find(e => !Array.isArray(e) && e.toStateId === sid('execute2'));
    expect(exec2Start).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npx jest test/integration/011.parallel_execution.test.ts 2>&1 | tail -10
```
Expected: FAIL — region terminal not handled.

- [ ] **Step 3: Add parallel terminal routing to `BasicStateMachine`**

Add these imports to `src/base/BasicStateMachine.ts`:

```ts
import type { ParallelState } from './ParallelState';
import type { Region } from './Region';
import { StateType as ST } from '../model/State';  // already imported as StateType
```

Actually just add:
```ts
import type { ParallelState } from './ParallelState';
import type { Region } from './Region';
```

In `_routeFromState`, replace the `'terminal'` case with:

```ts
case 'terminal': {
  const group = this._findGroupOwner(route.terminalId);
  if (group) {
    this._active.delete(group.id);
    group.stateStatus = status;
    this.onStateStopped.emit({ stateId: group.id, stateStatus: status, exitCode, payload });
    this._routeFromState(group.id, status, exitCode, payload);
    break;
  }
  const pr = this._findParallelRegion(route.terminalId);
  if (pr) {
    this._onRegionTerminal(pr.parallel, pr.region, status, exitCode, payload);
    break;
  }
  this.onStateMachineStopped.emit({ statemachineId: this.id, stateStatus: status, payload });
  break;
}
```

Add two new private methods to the class:

```ts
private _findParallelRegion(terminalId: StateId): { parallel: ParallelState; region: Region } | undefined {
  for (const s of this._states.all()) {
    if (s.type === StateType.Parallel) {
      const ps = s as ParallelState;
      const region = ps.findRegionForTerminal(terminalId);
      if (region) return { parallel: ps, region };
    }
  }
  return undefined;
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

  const regions = parallel.getRegions();

  // Cancel all still-active sibling regions if this one did not finish Ok
  if (status !== StateStatus.Ok) {
    for (const r of regions) {
      if (r !== region && r.status === StateStatus.Active) {
        for (const stateId of r.stateIds) {
          if (this._active.has(stateId)) {
            this._active.delete(stateId);
            const s = this._states.get(stateId);
            if (s) s.stateStatus = StateStatus.Canceled;
            r.status = StateStatus.Canceled;
            r.payload = undefined;
            this.onStateStopped.emit({ stateId, stateStatus: StateStatus.Canceled });
          }
        }
      }
    }
  }

  const allSettled = regions.every(
    (r) => r.status !== StateStatus.None && r.status !== StateStatus.Active,
  );
  if (!allSettled) return;

  // All regions done: complete the parallel state
  this._active.delete(parallel.id);
  const finalStatus = regions.some((r) => r.status === StateStatus.Error)
    ? StateStatus.Error
    : regions.some((r) => r.status === StateStatus.Canceled)
    ? StateStatus.Canceled
    : StateStatus.Ok;
  const aggregatedPayload = regions.map((r) => r.payload);
  parallel.stateStatus = finalStatus;
  this.onStateStopped.emit({ stateId: parallel.id, stateStatus: finalStatus, payload: aggregatedPayload });
  this._routeFromState(parallel.id, finalStatus, exitCode, aggregatedPayload);
}
```

- [ ] **Step 4: Run integration test — must pass**

```bash
npx jest test/integration/011.parallel_execution.test.ts
```
Expected: all 4 tests pass.

- [ ] **Step 5: Run full suite**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/base/BasicStateMachine.ts test/integration/011.parallel_execution.test.ts
git commit -m "feat: parallel region terminal routing and completion"
```

---

## Task 12: Cascade delete for parallel states

**Files:**
- Modify: `src/base/BasicStateMachine.ts`

When `deleteState(parallelId)` is called, cascade into each region. When `deleteState(regionMemberId)` or `deleteTransition(regionTransitionId)` are called, remove from the owning region.

- [ ] **Step 1: Write failing test**

Add to `test/cascade_delete.test.ts`:

```ts
import { ParallelState } from '@src/base/ParallelState';
import { StateType } from '@src/model/State';

describe('cascade delete — parallel', () => {
  function buildParallelForDelete() {
    const sm      = new BasicStateMachine(smid('test'));
    const builder = new StateMachineBuilder(sm);
    const init    = builder.createInitial(sid('init'));
    const ps      = builder.createParallel(sid('p1'));
    const term    = builder.createTerminal(sid('term'));
    builder.createTransition(tid('t0'), init.id, ps.id);
    builder.createTransition(tid('t1'), ps.id, term.id);

    const r1   = ps.createRegion('r1');
    const ri1  = builder.createInitial(sid('ri1'));
    const rs1  = builder.createState(sid('rs1'));
    const rt1  = builder.createTransition(tid('rt1'), ri1.id, rs1.id);
    const rt2  = builder.createTransition(tid('rt2'), rs1.id, r1.terminal.id);
    r1.addState(ri1); r1.addState(rs1);
    r1.addTransition(rt1); r1.addTransition(rt2);
    return { sm, ps, r1 };
  }

  it('deleteState on parallel removes all region members and transitions', () => {
    const { sm, ps } = buildParallelForDelete();
    const before = sm.getStateCount();
    sm.deleteState(sid('p1'));
    expect(sm.getState(sid('p1'))).toBeUndefined();
    expect(sm.getState(sid('ri1'))).toBeUndefined();
    expect(sm.getState(sid('rs1'))).toBeUndefined();
    expect(sm.getStateCount()).toBeLessThan(before);
  });

  it('deleteState on region member removes it from the region', () => {
    const { sm, r1 } = buildParallelForDelete();
    sm.deleteState(sid('rs1'));
    expect(sm.getState(sid('rs1'))).toBeUndefined();
    expect(r1.hasState(sid('rs1'))).toBe(false);
  });

  it('deleteTransition on region transition removes it from the region', () => {
    const { sm, r1 } = buildParallelForDelete();
    sm.deleteTransition(tid('rt1'));
    expect(sm.getTransition(tid('rt1'))).toBeUndefined();
    expect(r1.hasTransition(tid('rt1'))).toBe(false);
  });
});
```

Note: you need these imports at the top of `cascade_delete.test.ts`:
```ts
import { BasicStateMachine } from '@src/base/BasicStateMachine';
import { StateMachineBuilder } from '@src/base/StateMachineBuilder';
import type { StateMachineId, StateId, TransitionId } from '@src/model/types';
const smid = (s: string) => s as StateMachineId;
const sid  = (s: string) => s as StateId;
const tid  = (s: string) => s as TransitionId;
```

- [ ] **Step 2: Run test — verify fails**

```bash
npx jest test/cascade_delete.test.ts --testNamePattern="parallel" 2>&1 | tail -5
```

- [ ] **Step 3: Update `deleteState` in `BasicStateMachine`**

In `deleteState`, after the Group cascade block and before the transition cleanup loop, add:

```ts
if (state.type === StateType.Parallel) {
  const ps = state as ParallelState;
  for (const region of ps.getRegions()) {
    // Delete all region member states (including the implicit terminal)
    for (const childId of [...region.stateIds]) {
      if (this._states.get(childId)) this.deleteState(childId);
    }
  }
}
```

In the parentId detach block (the `if (state.parentId)` section), after the Group detach, add:

```ts
if (state.parentId) {
  const parent = this._states.get(state.parentId);
  if (parent?.type === StateType.Group) {
    (parent as GroupState).deleteState(id);
  } else if (parent?.type === StateType.Parallel) {
    const ps = parent as ParallelState;
    const region = ps.findRegionForState(id);
    region?.deleteState(id);
  }
}
```

- [ ] **Step 4: Update `deleteTransition` in `BasicStateMachine`**

In the parentId detach block of `deleteTransition`, after the Group detach, add:

```ts
if (t.parentId) {
  const parent = this._states.get(t.parentId);
  if (parent?.type === StateType.Group) {
    (parent as GroupState).deleteTransition(id);
  } else if (parent?.type === StateType.Parallel) {
    const ps = parent as ParallelState;
    // Find which region owns this transition
    for (const region of ps.getRegions()) {
      if (region.hasTransition(id)) {
        region.deleteTransition(id);
        break;
      }
    }
  }
}
```

Also add the import at the top of `BasicStateMachine.ts` (already added in Task 11 but confirm it's there):
```ts
import type { ParallelState } from './ParallelState';
import type { Region } from './Region';
```

- [ ] **Step 5: Run tests**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/base/BasicStateMachine.ts test/cascade_delete.test.ts
git commit -m "feat: cascade delete for ParallelState and region members"
```

---

## Task 13: Validator parallel rules

**Files:**
- Modify: `src/base/Validator.ts`

Add 5 new validation rules (numbered P1–P5 in comments). These run for every `StateType.Parallel` state.

- [ ] **Step 1: Write failing tests**

Add to `test/Validator.test.ts` (find the existing describe block and add inside it):

```ts
import { ParallelState } from '@src/base/ParallelState';

describe('parallel validation', () => {
  function buildValidParallel() {
    const sm      = new BasicStateMachine(smid('test'));
    const b       = new StateMachineBuilder(sm);
    const init    = b.createInitial(sid('init'));
    const ps      = b.createParallel(sid('p1'));
    const term    = b.createTerminal(sid('term'));
    b.createTransition(tid('t0'), init.id, ps.id);
    b.createTransition(tid('t1'), ps.id, term.id);

    const r1 = ps.createRegion('r1');
    const ri1 = b.createInitial(sid('ri1'));
    const rs1 = b.createState(sid('rs1'));
    b.createTransition(tid('rt1'), ri1.id, rs1.id);
    b.createTransition(tid('rt2'), rs1.id, r1.terminal.id);
    r1.addState(ri1); r1.addState(rs1);

    const r2 = ps.createRegion('r2');
    const ri2 = b.createInitial(sid('ri2'));
    const rs2 = b.createState(sid('rs2'));
    b.createTransition(tid('rt3'), ri2.id, rs2.id);
    b.createTransition(tid('rt4'), rs2.id, r2.terminal.id);
    r2.addState(ri2); r2.addState(rs2);

    return { sm, b, ps, r1, r2 };
  }

  it('valid parallel passes validation', () => {
    const { sm } = buildValidParallel();
    expect(() => sm.validate()).not.toThrow();
  });

  it('P1: region with no Initial throws', () => {
    const { sm, r1 } = buildValidParallel();
    // Remove the initial from region1 membership (state stays in SM but not in region)
    r1.deleteState(sid('ri1'));
    expect(() => sm.validate()).toThrow(/P1.*region.*initial/i);
  });

  it('P2: region with no terminal throws', () => {
    const { sm, b, r1 } = buildValidParallel();
    // Add a second terminal to force a different error path — easier: delete region terminal
    sm.deleteState(r1.terminal.id);
    expect(() => sm.validate()).toThrow(/P2.*region.*terminal/i);
  });

  it('P3: cross-region transition throws', () => {
    const { sm, b } = buildValidParallel();
    b.createTransition(tid('cross'), sid('rs1'), sid('rs2'));
    expect(() => sm.validate()).toThrow(/P3.*cross.*region/i);
  });

  it('P5: region state transitioning to outer terminal throws', () => {
    const { sm, b, r1 } = buildValidParallel();
    b.createTransition(tid('bypass'), sid('rs1'), sid('term'));
    r1.addState(sm.getState(sid('rs1'))!);  // already in region but re-confirm
    expect(() => sm.validate()).toThrow(/P5.*outer terminal/i);
  });
});
```

Note: imports needed at top of `Validator.test.ts`:
```ts
import { BasicStateMachine } from '@src/base/BasicStateMachine';
import { StateMachineBuilder } from '@src/base/StateMachineBuilder';
const smid = (s: string) => s as StateMachineId;
const sid  = (s: string) => s as StateId;
const tid  = (s: string) => s as TransitionId;
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx jest test/Validator.test.ts --testNamePattern="parallel" 2>&1 | tail -10
```

- [ ] **Step 3: Add parallel validation to `Validator.ts`**

Add this import at the top:
```ts
import type { ParallelState } from './ParallelState';
import { StateType as ST } from '../model/State'; // already imported as StateType
```

Actually just:
```ts
import type { ParallelState } from './ParallelState';
```

Add this function before the `validateStateMachine` entry point:

```ts
function validateParallels(
  allStates: readonly State[],
  allTransitions: readonly Transition[],
  states: StateRegistry,
): void {
  for (const s of allStates.filter((state) => state.type === StateType.Parallel)) {
    const ps = s as ParallelState;
    const outerTerminalIds = new Set(
      allStates.filter((st) => st.type === StateType.Terminal && !ps.findRegionForState(st.id)).map((st) => st.id),
    );

    for (const region of ps.getRegions()) {
      // P1: region must have exactly one Initial
      const initials = Array.from(region.stateIds).filter(
        (id) => states.get(id)?.type === StateType.Initial,
      );
      if (initials.length !== 1) {
        throw new SMValidationException(
          `P1: Region '${region.id}' in parallel '${ps.id}' must have exactly 1 Initial state, found ${initials.length}`,
        );
      }

      // P2: region terminal must still be in region
      if (!region.hasState(region.terminal.id) && !states.get(region.terminal.id)) {
        throw new SMValidationException(
          `P2: Region '${region.id}' in parallel '${ps.id}' is missing its terminal state`,
        );
      }

      // P3: no transition may cross region boundaries
      for (const tId of region.transitionIds) {
        const t = allTransitions.find((tr) => tr.id === tId);
        if (!t) continue;
        const fromInRegion = region.hasState(t.fromStateId);
        const toInRegion = region.hasState(t.toStateId);
        if (fromInRegion && !toInRegion && t.toStateId !== region.terminal.id) {
          // check if toState is in another region
          for (const other of ps.getRegions()) {
            if (other !== region && other.hasState(t.toStateId)) {
              throw new SMValidationException(
                `P3: transition '${t.id}' crosses region boundary between '${region.id}' and '${other.id}'`,
              );
            }
          }
        }
      }

      // P5: region state must not transition directly to outer terminal
      for (const stateId of region.stateIds) {
        const st = states.get(stateId);
        if (!st) continue;
        for (const tId of st.outgoing) {
          const t = allTransitions.find((tr) => tr.id === tId);
          if (t && outerTerminalIds.has(t.toStateId)) {
            throw new SMValidationException(
              `P5: state '${stateId}' in region '${region.id}' transitions directly to outer terminal '${t.toStateId}' — must go through region terminal`,
            );
          }
        }
      }
    }
  }
}
```

In `validateStateMachine`, add a call at the end:

```ts
export function validateStateMachine(states: StateRegistry, transitions: TransitionRegistry): void {
  const allStates = states.all();
  const allTransitions = transitions.all();
  const topLevel = buildTopLevel(allStates);
  const initial = validateRule1(topLevel);
  validateRule5(allTransitions, states);
  validateRule16(allTransitions);
  validateReachability(initial, topLevel, states, transitions);
  validateChoices(allStates, transitions);
  validateForks(allStates, states, transitions);
  validateJoins(allStates, states, transitions);
  validateGroups(allStates, allTransitions, states, transitions);
  validateParallels(allStates, allTransitions, states);   // ← add this
}
```

Note on P2: The test deletes `region.terminal` from the SM. The simplest P2 check is whether `states.get(region.terminal.id)` is undefined:

```ts
// P2: region terminal must exist in the SM registry
if (!states.get(region.terminal.id)) {
  throw new SMValidationException(
    `P2: Region '${region.id}' in parallel '${ps.id}' is missing its terminal state`,
  );
}
```

Replace the P2 block above with just this simpler version.

- [ ] **Step 4: Run tests**

```bash
npm test
```
Expected: all pass including the 5 new parallel validation tests.

- [ ] **Step 5: Commit**

```bash
git add src/base/Validator.ts test/Validator.test.ts
git commit -m "feat: parallel validation rules P1-P3 and P5"
```

---

## Task 14: Exports and final verification

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add exports to `src/index.ts`**

Add at the end of the file:

```ts
export { Region } from './base/Region';
export { ParallelState } from './base/ParallelState';
export { StateMachineBuilder } from './base/StateMachineBuilder';
```

Note: check if `StateMachineBuilder` is already exported — if so, skip that line.

- [ ] **Step 2: Run full test suite with coverage**

```bash
npm run test:coverage
```
Expected: all tests pass, coverage above 80% on all metrics.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```
Expected: no errors. If lint errors exist, run `npm run lint:fix` and commit the fixes.

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat: export Region and ParallelState from index"
```

---

## Self-Review

**Spec coverage check:**
- [x] `StateType.Parallel` added — Task 8
- [x] `Region` class with `stateIds`, `transitionIds`, implicit terminal — Task 7
- [x] `ParallelState` with `createRegion`, `getRegions`, `payloadClone` — Task 8
- [x] `StateMachineBuilder.createParallel` — Task 9
- [x] Happy path: both Ok, aggregated payload — Task 11 test
- [x] Region failure: cancel siblings, exit with Error — Task 11 test
- [x] Validation P1 (no initial), P2 (no terminal), P3 (cross-region), P5 (outer terminal bypass) — Task 13
- [x] Cascade delete — Task 12
- [ ] **P4 (parallel → choice without intervening state)** — not implemented. Validation rule P4 from the spec ("parallel state may not be directly followed by a choice") is omitted; add it to Task 13's `validateParallels` if needed. The logic: for each outgoing transition from the parallel state, check if target is a `Choice`.

**P4 addition** (add to `validateParallels` after the region loops, before the closing brace):

```ts
// P4: parallel may not be directly followed by Choice
for (const tId of ps.outgoing) {
  const t = allTransitions.find((tr) => tr.id === tId);
  if (t && states.get(t.toStateId)?.type === StateType.Choice) {
    throw new SMValidationException(
      `P4: Parallel '${ps.id}' is directly followed by Choice '${t.toStateId}' without an intervening state`,
    );
  }
}
```

Add test for P4 in the validator test block:
```ts
it('P4: parallel directly followed by Choice throws', () => {
  const { sm, b, ps } = buildValidParallel();
  const ch = b.createChoice(sid('ch1'));
  b.createTransition(tid('bad'), ps.id, ch.id);
  expect(() => sm.validate()).toThrow(/P4.*choice/i);
});
```