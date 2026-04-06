# State Machine Equivalence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `compareStates`, `compareTransitions`, and `compareStateMachines` functions, update `MermaidParser` to emit deterministic IDs, update integration test build functions to use those IDs, and add Mermaid-vs-builder integration comparison tests.

**Architecture:** Three standalone comparator functions in `src/compare.ts` do field-by-field ID-based matching. `MermaidParser` drops its counter in favour of `${fromId}-->${toId}` transition IDs and fixed initial/terminal names. Integration tests that previously used opaque transition IDs (`t0`, `t1`, …) are updated to use the deterministic format so their output matches the parser's output exactly.

**Tech Stack:** TypeScript, Jest, existing `IState` / `ITransition` / `IStateMachine` interfaces, `StateMachineBuilder`, `MermaidParser`.

---

## File Map

| File | Change |
|---|---|
| `src/compare.ts` | **Create** — three exported comparator functions |
| `src/index.ts` | **Modify** — export the three comparators |
| `src/parser/MermaidParser.ts` | **Modify** — replace counter IDs with deterministic IDs |
| `test/compare.test.ts` | **Create** — unit tests for all three comparators |
| `test/integration/002.basic_state.test.ts` | **Modify** — update transition IDs in `buildSM()` |
| `test/integration/003.basic_transition.test.ts` | **Modify** — update transition IDs in `build()` |
| `test/integration/004.transition_narrowing.test.ts` | **Modify** — update transition IDs in `build()` |
| `test/integration/005.transition_selection.test.ts` | **Modify** — update transition IDs in both `build()` and inline test |
| `test/integration/006.transition_by_exit_code.test.ts` | **Modify** — update transition IDs in `build()` |
| `test/integration/007.payloads.test.ts` | **Modify** — update transition IDs in inline test |
| `test/integration/008.fork_join.test.ts` | **Modify** — update transition IDs in `build()` |
| `test/integration/009.group_execution.test.ts` | **Modify** — update state IDs + transition IDs in `build()` |
| `test/integration/compare.integration.test.ts` | **Create** — Mermaid-vs-builder comparison tests for 002-009 |

---

## Deterministic ID Rules (reference for all tasks)

**State IDs (auto-created by parser):**
- Root initial → `initial`
- Root terminal → `terminal`
- Group initial → `${groupId}__initial`
- Group terminal → `${groupId}__terminal`

**Transition IDs:**
```
const guardKey = [status ?? '', exitCode ?? ''].filter(Boolean).join('/');
const tId = guardKey ? `${fromId}-->${toId}:${guardKey}` : `${fromId}-->${toId}`;
```
Examples:
- Unguarded: `initial-->loadConfig`
- Status-only: `loadConfig-->execute:ok`
- Status+exitCode: `ch-->execute_a:ok/planA`
- AnyStatus: `ch-->logError:any`

---

## Task 1: Write failing unit tests for the comparators

**Files:**
- Create: `test/compare.test.ts`

- [ ] **Step 1: Create test file**

```typescript
// test/compare.test.ts
import { BasicStateMachine } from '../src/BasicStateMachine';
import { StateMachineBuilder } from '../src/StateMachineBuilder';
import { StateStatus, StateType } from '../src/IState';
import { UserDefinedState } from '../src/states/UserDefinedState';
import { Transition } from '../src/Transition';
import { compareStates, compareTransitions, compareStateMachines } from '../src/compare';
import type { StateId, TransitionId, StateMachineId } from '../src/types';

const sid = (s: string) => s as StateId;
const tid = (s: string) => s as TransitionId;
const smid = (s: string) => s as StateMachineId;

// ── compareStates ──────────────────────────────────────────────────────────

describe('compareStates', () => {
  function makeState(overrides: Partial<{
    id: string;
    type: StateType;
    parentId: string | undefined;
    config: Record<string, unknown> | undefined;
    incoming: string[];
    outgoing: string[];
  }> = {}) {
    const s = new UserDefinedState(
      sid(overrides.id ?? 'a'),
      overrides.config,
      overrides.parentId !== undefined ? sid(overrides.parentId) : undefined,
    );
    for (const t of overrides.incoming ?? []) s.incoming.add(tid(t));
    for (const t of overrides.outgoing ?? []) s.outgoing.add(tid(t));
    return s;
  }

  it('returns true for identical states', () => {
    const a = makeState({ id: 'a', incoming: ['t1'], outgoing: ['t2'] });
    const b = makeState({ id: 'a', incoming: ['t1'], outgoing: ['t2'] });
    expect(compareStates(a, b)).toBe(true);
  });

  it('returns false when id differs', () => {
    expect(compareStates(makeState({ id: 'a' }), makeState({ id: 'b' }))).toBe(false);
  });

  it('returns false when type differs', () => {
    const a = makeState({ id: 'a' });
    const b = makeState({ id: 'a' });
    // Override type after construction to simulate a different state type
    Object.defineProperty(b, 'type', { value: StateType.Choice });
    expect(compareStates(a, b)).toBe(false);
  });

  it('returns false when parentId differs', () => {
    const a = makeState({ id: 'a', parentId: 'g1' });
    const b = makeState({ id: 'a', parentId: 'g2' });
    expect(compareStates(a, b)).toBe(false);
  });

  it('returns false when parentId is present on one only', () => {
    const a = makeState({ id: 'a', parentId: 'g1' });
    const b = makeState({ id: 'a', parentId: undefined });
    expect(compareStates(a, b)).toBe(false);
  });

  it('returns false when incoming sets differ', () => {
    const a = makeState({ id: 'a', incoming: ['t1'] });
    const b = makeState({ id: 'a', incoming: ['t2'] });
    expect(compareStates(a, b)).toBe(false);
  });

  it('returns false when outgoing sets differ', () => {
    const a = makeState({ id: 'a', outgoing: ['t1'] });
    const b = makeState({ id: 'a', outgoing: [] });
    expect(compareStates(a, b)).toBe(false);
  });

  it('returns false when config values differ', () => {
    const a = makeState({ id: 'a', config: { x: 1 } });
    const b = makeState({ id: 'a', config: { x: 2 } });
    expect(compareStates(a, b)).toBe(false);
  });

  it('returns false when config keys differ', () => {
    const a = makeState({ id: 'a', config: { x: 1 } });
    const b = makeState({ id: 'a', config: { y: 1 } });
    expect(compareStates(a, b)).toBe(false);
  });

  it('returns true when config key order differs (deep equal)', () => {
    const a = makeState({ id: 'a', config: { x: 1, y: 2 } });
    const b = makeState({ id: 'a', config: { y: 2, x: 1 } });
    expect(compareStates(a, b)).toBe(true);
  });

  it('returns false when one config is undefined and other is not', () => {
    const a = makeState({ id: 'a', config: undefined });
    const b = makeState({ id: 'a', config: { x: 1 } });
    expect(compareStates(a, b)).toBe(false);
  });

  it('does not compare stateStatus', () => {
    const a = makeState({ id: 'a' });
    const b = makeState({ id: 'a' });
    b.stateStatus = StateStatus.Active;
    expect(compareStates(a, b)).toBe(true);
  });
});

// ── compareTransitions ─────────────────────────────────────────────────────

describe('compareTransitions', () => {
  function makeTransition(overrides: Partial<{
    id: string;
    fromStateId: string;
    toStateId: string;
    status: StateStatus | undefined;
    exitCode: string | undefined;
    parentId: string | undefined;
  }> = {}) {
    return new Transition(
      tid(overrides.id ?? 't1'),
      sid(overrides.fromStateId ?? 'a'),
      sid(overrides.toStateId ?? 'b'),
      overrides.status,
      overrides.exitCode,
      overrides.parentId !== undefined ? sid(overrides.parentId) : undefined,
    );
  }

  it('returns true for identical transitions', () => {
    const a = makeTransition({ id: 't1', fromStateId: 'a', toStateId: 'b', status: StateStatus.Ok, exitCode: 'done', parentId: 'g' });
    const b = makeTransition({ id: 't1', fromStateId: 'a', toStateId: 'b', status: StateStatus.Ok, exitCode: 'done', parentId: 'g' });
    expect(compareTransitions(a, b)).toBe(true);
  });

  it('returns false when id differs', () => {
    expect(compareTransitions(makeTransition({ id: 't1' }), makeTransition({ id: 't2' }))).toBe(false);
  });

  it('returns false when fromStateId differs', () => {
    expect(compareTransitions(makeTransition({ fromStateId: 'a' }), makeTransition({ fromStateId: 'x' }))).toBe(false);
  });

  it('returns false when toStateId differs', () => {
    expect(compareTransitions(makeTransition({ toStateId: 'b' }), makeTransition({ toStateId: 'y' }))).toBe(false);
  });

  it('returns false when status differs', () => {
    expect(compareTransitions(makeTransition({ status: StateStatus.Ok }), makeTransition({ status: StateStatus.Error }))).toBe(false);
  });

  it('returns false when status is present on one only', () => {
    expect(compareTransitions(makeTransition({ status: StateStatus.Ok }), makeTransition({ status: undefined }))).toBe(false);
  });

  it('returns false when exitCode differs', () => {
    expect(compareTransitions(makeTransition({ exitCode: 'planA' }), makeTransition({ exitCode: 'planB' }))).toBe(false);
  });

  it('returns false when exitCode is present on one only', () => {
    expect(compareTransitions(makeTransition({ exitCode: 'done' }), makeTransition({ exitCode: undefined }))).toBe(false);
  });

  it('returns false when parentId differs', () => {
    expect(compareTransitions(makeTransition({ parentId: 'g1' }), makeTransition({ parentId: 'g2' }))).toBe(false);
  });
});

// ── compareStateMachines ───────────────────────────────────────────────────

describe('compareStateMachines', () => {
  function buildSimple(transitionId = 'initial-->s1') {
    const sm = new BasicStateMachine(smid('test'));
    const b = new StateMachineBuilder(sm);
    const init = b.createInitial(sid('initial'));
    const s1   = b.createState(sid('s1'));
    const term = b.createTerminal(sid('terminal'));
    b.createTransition(tid(transitionId), init.id, s1.id);
    b.createTransition(tid('s1-->terminal'), s1.id, term.id);
    return sm;
  }

  it('returns true for two identically built machines', () => {
    expect(compareStateMachines(buildSimple(), buildSimple())).toBe(true);
  });

  it('returns false when b has an extra state', () => {
    const a = buildSimple();
    const b = buildSimple();
    new StateMachineBuilder(b).createState(sid('extra'));
    expect(compareStateMachines(a, b)).toBe(false);
  });

  it('returns false when b has an extra transition', () => {
    const a = buildSimple();
    const b = buildSimple();
    const bld = new StateMachineBuilder(b);
    const extra = bld.createState(sid('extra'));
    bld.createTransition(tid('s1-->extra'), sid('s1'), extra.id);
    // state count now differs too — that's fine, this still tests the transition path
    expect(compareStateMachines(a, b)).toBe(false);
  });

  it('returns false when a state field differs between machines', () => {
    const a = buildSimple();
    const b = buildSimple('different-->s1'); // transition ID differs → s1.incoming differs
    expect(compareStateMachines(a, b)).toBe(false);
  });

  it('does not compare machine ids', () => {
    const a = new BasicStateMachine(smid('machineA'));
    const b = new BasicStateMachine(smid('machineB'));
    const ba = new StateMachineBuilder(a);
    const bb = new StateMachineBuilder(b);
    const ai = ba.createInitial(sid('initial'));
    const bi = bb.createInitial(sid('initial'));
    const at = ba.createTerminal(sid('terminal'));
    const bt = bb.createTerminal(sid('terminal'));
    ba.createTransition(tid('initial-->terminal'), ai.id, at.id);
    bb.createTransition(tid('initial-->terminal'), bi.id, bt.id);
    expect(compareStateMachines(a, b)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail because `src/compare.ts` does not exist**

```bash
cd c:/Users/lassc/Code/typescript/mstate && npx jest test/compare.test.ts --no-coverage 2>&1 | head -20
```

Expected: error like `Cannot find module '../src/compare'`

---

## Task 2: Implement `src/compare.ts`

**Files:**
- Create: `src/compare.ts`

- [ ] **Step 1: Create implementation**

```typescript
// src/compare.ts
import type { IState } from './IState';
import type { ITransition } from './ITransition';
import type { IStateMachine } from './IStateMachine';

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function sortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>)
      .sort(([ka], [kb]) => ka.localeCompare(kb))
      .map(([k, v]) => [k, sortKeys(v)]),
  );
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  if (a === null || b === null) return false;
  return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
}

export function compareStates(a: IState, b: IState): boolean {
  return (
    a.id === b.id &&
    a.type === b.type &&
    a.parentId === b.parentId &&
    setsEqual(a.incoming, b.incoming) &&
    setsEqual(a.outgoing, b.outgoing) &&
    deepEqual(a.config, b.config)
  );
}

export function compareTransitions(a: ITransition, b: ITransition): boolean {
  return (
    a.id === b.id &&
    a.fromStateId === b.fromStateId &&
    a.toStateId === b.toStateId &&
    a.status === b.status &&
    a.exitCode === b.exitCode &&
    a.parentId === b.parentId
  );
}

export function compareStateMachines(a: IStateMachine, b: IStateMachine): boolean {
  if (a.getStateCount() !== b.getStateCount()) return false;
  if (a.getTransitionCount() !== b.getTransitionCount()) return false;

  for (const id of a.getStateIds()) {
    const stateB = b.getState(id);
    if (!stateB) return false;
    if (!compareStates(a.getState(id)!, stateB)) return false;
  }
  for (const id of b.getStateIds()) {
    if (!a.getState(id)) return false;
  }

  for (const id of a.getTransitionIds()) {
    const tB = b.getTransition(id);
    if (!tB) return false;
    if (!compareTransitions(a.getTransition(id)!, tB)) return false;
  }
  for (const id of b.getTransitionIds()) {
    if (!a.getTransition(id)) return false;
  }

  return true;
}
```

- [ ] **Step 2: Run unit tests**

```bash
cd c:/Users/lassc/Code/typescript/mstate && npx jest test/compare.test.ts --no-coverage
```

Expected: all tests PASS

---

## Task 3: Export comparators and commit

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add exports to `src/index.ts`**

After the existing `export { createStateModel }` line, add:

```typescript
export { compareStates, compareTransitions, compareStateMachines } from './compare';
```

- [ ] **Step 2: Run typecheck**

```bash
cd c:/Users/lassc/Code/typescript/mstate && npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
cd c:/Users/lassc/Code/typescript/mstate && git add src/compare.ts src/index.ts test/compare.test.ts && git commit -m "feat: add compareStates, compareTransitions, compareStateMachines"
```

---

## Task 4: Update `MermaidParser.ts` to deterministic IDs

**Files:**
- Modify: `src/parser/MermaidParser.ts`

- [ ] **Step 1: Replace the full file content**

Replace `src/parser/MermaidParser.ts` with the following (the only changes from the original are: remove `_counter`/`nextId`, inline deterministic ID logic in `ensureInitial`, `ensureTerminal`, transition creation, and the title fallback):

```typescript
import type { StateMachineId, StateId, TransitionId } from '../types';
import type { IGroupState } from '@src/IGroupState';
import { StateStatus } from '@src/IState';
import type { IStateMachine } from '@src/IStateMachine';
import { SMValidationException } from '../exceptions';
import { BasicStateMachine } from '../BasicStateMachine';
import { extractTitle, tokenize } from './tokenizer';
import { StateMachineBuilder } from '@src/StateMachineBuilder';

const STATUS_MAP: Record<string, StateStatus> = {
  ok: StateStatus.Ok,
  error: StateStatus.Error,
  canceled: StateStatus.Canceled,
  exception: StateStatus.Exception,
  any: StateStatus.AnyStatus,
};

export class MermaidParser {
  parse(diagramText: string): IStateMachine {
    const title = extractTitle(diagramText) || crypto.randomUUID();
    const tokens = tokenize(diagramText);
    const sm = new BasicStateMachine(title as StateMachineId);
    const builder = new StateMachineBuilder(sm);

    const declared = new Map<string, 'choice' | 'fork' | 'join'>();
    const groupStack: string[] = [];
    const groupMembers = new Map<string, Set<string>>();

    // ── Pass 1: collect state declarations and group membership ──────────────
    let depth = 0;
    let currentGroup: string | null = null;

    for (const tok of tokens) {
      if (tok.kind === 'stateDecl') {
        declared.set(tok.id, tok.stateType);
      } else if (tok.kind === 'groupOpen') {
        if (depth === 0) currentGroup = tok.id;
        if (currentGroup && !groupMembers.has(currentGroup)) {
          groupMembers.set(currentGroup, new Set());
        }
        groupStack.push(tok.id);
        depth++;
      } else if (tok.kind === 'groupClose') {
        groupStack.pop();
        depth--;
        if (depth === 0) currentGroup = null;
      } else if (tok.kind === 'transition' && currentGroup !== null) {
        const members = groupMembers.get(currentGroup)!;
        if (tok.from !== '[*]') members.add(tok.from);
        if (tok.to !== '[*]') members.add(tok.to);
      }
    }

    // ── Helper: ensure a state is created (idempotent) ───────────────────────
    const ensured = new Set<string>();
    const initIds = new Map<string, string>();
    const termIds = new Map<string, string>();

    const ensureState = (id: string): void => {
      if (ensured.has(id)) return;
      ensured.add(id);
      const type = declared.get(id);
      if (type === 'choice') {
        builder.createChoice(id as StateId);
        return;
      }
      if (type === 'fork') {
        builder.createFork(id as StateId);
        return;
      }
      if (type === 'join') {
        builder.createJoin(id as StateId);
        return;
      }
      if (groupMembers.has(id)) {
        builder.createGroup(id as StateId);
        for (const memberId of groupMembers.get(id)!) {
          ensureState(memberId);
          const gs = sm.getState(id as StateId);
          const ms = sm.getState(memberId as StateId);
          if (gs && ms) (gs as IGroupState).addState(ms);
        }
        return;
      }
      builder.createState(id as StateId);
    };

    const ensureInitial = (context: string | null): string => {
      const key = context ?? '__root__';
      if (initIds.has(key)) return initIds.get(key)!;
      const id = context ? `${context}__initial` : 'initial';
      builder.createInitial(id as StateId);
      if (context) {
        const gs = sm.getState(context as StateId) as IGroupState;
        const is = sm.getState(id as StateId)!;
        gs?.addState(is);
      }
      initIds.set(key, id);
      return id;
    };

    const ensureTerminal = (context: string | null): string => {
      const key = context ?? '__root__';
      if (termIds.has(key)) return termIds.get(key)!;
      const id = context ? `${context}__terminal` : 'terminal';
      builder.createTerminal(id as StateId);
      if (context) {
        const gs = sm.getState(context as StateId) as IGroupState;
        const ts = sm.getState(id as StateId)!;
        gs?.addState(ts);
      }
      termIds.set(key, id);
      return id;
    };

    // ── Pass 2: build transitions ─────────────────────────────────────────────
    depth = 0;
    currentGroup = null;
    const groupDepthStack: (string | null)[] = [];

    for (const tok of tokens) {
      if (tok.kind === 'groupOpen') {
        groupDepthStack.push(currentGroup);
        currentGroup = tok.id;
        ensureState(tok.id);
        depth++;
        continue;
      }
      if (tok.kind === 'groupClose') {
        currentGroup = groupDepthStack.pop() ?? null;
        depth--;
        continue;
      }
      if (tok.kind !== 'transition') continue;

      const fromId = tok.from === '[*]' ? ensureInitial(currentGroup) : tok.from;
      const toId = tok.to === '[*]' ? ensureTerminal(currentGroup) : tok.to;

      if (tok.from !== '[*]') ensureState(tok.from);
      if (tok.to !== '[*]') ensureState(tok.to);

      let status: StateStatus | undefined;
      let exitCode: string | undefined;

      if (tok.label) {
        const parts = tok.label.split('/');
        const rawStatus = parts[0]?.trim().toLowerCase();
        if (rawStatus) {
          status = STATUS_MAP[rawStatus];
          if (status === undefined) {
            throw new SMValidationException(`Unknown status label '${parts[0]}' in transition`);
          }
        }
        if (parts.length > 2) {
          throw new SMValidationException(
            `Malformed transition label '${tok.label}' — at most one '/' allowed`,
          );
        }
        exitCode = parts[1]?.trim() || undefined;
      }

      const guardKey = [status ?? '', exitCode ?? ''].filter(Boolean).join('/');
      const tId = (guardKey ? `${fromId}-->${toId}:${guardKey}` : `${fromId}-->${toId}`) as TransitionId;
      builder.createTransition(tId, fromId as StateId, toId as StateId, status, exitCode);
    }

    return sm;
  }
}
```

- [ ] **Step 2: Run MermaidParser tests**

```bash
cd c:/Users/lassc/Code/typescript/mstate && npx jest test/parser/MermaidParser.test.ts --no-coverage
```

Expected: all 8 tests PASS (no test checked initial/terminal IDs or transition IDs directly)

- [ ] **Step 3: Run full test suite to see what breaks**

```bash
cd c:/Users/lassc/Code/typescript/mstate && npm test 2>&1 | tail -30
```

Expected: integration tests 002-009 fail because their transition IDs no longer match the new parser output (this is expected — fixed in Tasks 5-7)

---

## Task 5: Update integration tests 002-007 transition IDs

**Files:**
- Modify: `test/integration/002.basic_state.test.ts`
- Modify: `test/integration/003.basic_transition.test.ts`
- Modify: `test/integration/004.transition_narrowing.test.ts`
- Modify: `test/integration/005.transition_selection.test.ts`
- Modify: `test/integration/006.transition_by_exit_code.test.ts`
- Modify: `test/integration/007.payloads.test.ts`

Note: The tests in this task do not assert on transition IDs — only their `buildSM()`/`build()` functions need updating. The existing assertions remain unchanged.

- [ ] **Step 1: Update 002 — transition IDs in `buildSM()`**

In `test/integration/002.basic_state.test.ts`, replace the two `createTransition` calls inside `buildSM()`:

```typescript
// Replace:
builder.createTransition(tid('t0'), init.id, s1.id);
builder.createTransition(tid('t1'), s1.id, term.id);

// With:
builder.createTransition(tid('initial-->initialize'), init.id, s1.id);
builder.createTransition(tid('initialize-->terminal'), s1.id, term.id);
```

- [ ] **Step 2: Update 003 — transition IDs in `build()`**

In `test/integration/003.basic_transition.test.ts`, replace the three `createTransition` calls:

```typescript
// Replace:
builder.createTransition(tid('t0'), init.id, s1.id);
builder.createTransition(tid('t1'), s1.id, s2.id);
builder.createTransition(tid('t2'), s2.id, term.id);

// With:
builder.createTransition(tid('initial-->init'), init.id, s1.id);
builder.createTransition(tid('init-->execute'), s1.id, s2.id);
builder.createTransition(tid('execute-->terminal'), s2.id, term.id);
```

- [ ] **Step 3: Update 004 — transition IDs in `build()`**

In `test/integration/004.transition_narrowing.test.ts`, replace the three `createTransition` calls:

```typescript
// Replace:
builder.createTransition(tid('t0'), init.id, lc.id);
builder.createTransition(tid('t1'), lc.id, exec.id, StateStatus.Ok);
builder.createTransition(tid('t2'), exec.id, term.id);

// With:
builder.createTransition(tid('initial-->loadConfig'), init.id, lc.id);
builder.createTransition(tid('loadConfig-->execute:ok'), lc.id, exec.id, StateStatus.Ok);
builder.createTransition(tid('execute-->terminal'), exec.id, term.id);
```

- [ ] **Step 4: Update 005 — transition IDs in both `build()` and the inline `defaultBranch` test**

In `test/integration/005.transition_selection.test.ts`:

Replace the six `createTransition` calls in `build()`:

```typescript
// Replace:
builder.createTransition(tid('t0'), init.id, lc.id);
builder.createTransition(tid('t1'), lc.id, ch.id);
builder.createTransition(tid('t2'), ch.id, exec.id, StateStatus.Ok);
builder.createTransition(tid('t3'), ch.id, err.id, StateStatus.Error);
builder.createTransition(tid('t4'), exec.id, term.id);
builder.createTransition(tid('t5'), err.id, term.id);

// With:
builder.createTransition(tid('initial-->loadConfig'), init.id, lc.id);
builder.createTransition(tid('loadConfig-->loadConfigChoice'), lc.id, ch.id);
builder.createTransition(tid('loadConfigChoice-->execute:ok'), ch.id, exec.id, StateStatus.Ok);
builder.createTransition(tid('loadConfigChoice-->logError:error'), ch.id, err.id, StateStatus.Error);
builder.createTransition(tid('execute-->terminal'), exec.id, term.id);
builder.createTransition(tid('logError-->terminal'), err.id, term.id);
```

Replace the six `createTransition` calls in the inline `defaultBranch` test:

```typescript
// Replace:
builder.createTransition(tid('t0'), init.id, lc.id);
builder.createTransition(tid('t1'), lc.id, ch.id);
builder.createTransition(tid('t2'), ch.id, exec.id, StateStatus.Ok);
builder.createTransition(tid('t3'), ch.id, def.id);
builder.createTransition(tid('t4'), exec.id, term.id);
builder.createTransition(tid('t5'), def.id, term.id);

// With:
builder.createTransition(tid('initial-->lc'), init.id, lc.id);
builder.createTransition(tid('lc-->ch'), lc.id, ch.id);
builder.createTransition(tid('ch-->exec:ok'), ch.id, exec.id, StateStatus.Ok);
builder.createTransition(tid('ch-->default'), ch.id, def.id);
builder.createTransition(tid('exec-->term'), exec.id, term.id);
builder.createTransition(tid('default-->term'), def.id, term.id);
```

- [ ] **Step 5: Update 006 — transition IDs in `build()`**

In `test/integration/006.transition_by_exit_code.test.ts`, replace the eight `createTransition` calls:

```typescript
// Replace:
builder.createTransition(tid('t0'), init.id, lc.id);
builder.createTransition(tid('t1'), lc.id, ch.id);
builder.createTransition(tid('t2'), ch.id, a.id, StateStatus.Ok, 'planA');
builder.createTransition(tid('t3'), ch.id, b.id, StateStatus.Ok, 'planB');
builder.createTransition(tid('t4'), ch.id, err.id, StateStatus.AnyStatus);
builder.createTransition(tid('t5'), a.id, term.id);
builder.createTransition(tid('t6'), b.id, term.id);
builder.createTransition(tid('t7'), err.id, term.id);

// With:
builder.createTransition(tid('initial-->loadConfig'), init.id, lc.id);
builder.createTransition(tid('loadConfig-->ch'), lc.id, ch.id);
builder.createTransition(tid('ch-->execute_a:ok/planA'), ch.id, a.id, StateStatus.Ok, 'planA');
builder.createTransition(tid('ch-->execute_b:ok/planB'), ch.id, b.id, StateStatus.Ok, 'planB');
builder.createTransition(tid('ch-->logError:any'), ch.id, err.id, StateStatus.AnyStatus);
builder.createTransition(tid('execute_a-->terminal'), a.id, term.id);
builder.createTransition(tid('execute_b-->terminal'), b.id, term.id);
builder.createTransition(tid('logError-->terminal'), err.id, term.id);
```

- [ ] **Step 6: Update 007 — transition IDs in the inline test**

In `test/integration/007.payloads.test.ts`, replace the three `createTransition` calls:

```typescript
// Replace:
builder.createTransition(tid('t0'), init.id, s1.id);
builder.createTransition(tid('t1'), s1.id, s2.id);
builder.createTransition(tid('t2'), s2.id, term.id);

// With:
builder.createTransition(tid('initial-->init'), init.id, s1.id);
builder.createTransition(tid('init-->execute'), s1.id, s2.id);
builder.createTransition(tid('execute-->terminal'), s2.id, term.id);
```

- [ ] **Step 7: Run tests 002-007 to confirm they still pass**

```bash
cd c:/Users/lassc/Code/typescript/mstate && npx jest test/integration/00[2-7] --no-coverage
```

Expected: all tests PASS (assertions don't rely on transition IDs)

---

## Task 6: Update integration test 008 transition IDs

**Files:**
- Modify: `test/integration/008.fork_join.test.ts`

- [ ] **Step 1: Update transition IDs in `build()`**

In `test/integration/008.fork_join.test.ts`, replace the eight `createTransition` calls:

```typescript
// Replace:
builder.createTransition(tid('t0'), init.id, s1.id);
builder.createTransition(tid('t1'), s1.id, fork.id);
builder.createTransition(tid('f1'), fork.id, a.id);
builder.createTransition(tid('f2'), fork.id, b.id);
builder.createTransition(tid('j1'), a.id, join.id);
builder.createTransition(tid('j2'), b.id, join.id);
builder.createTransition(tid('t2'), join.id, out.id);
builder.createTransition(tid('t3'), out.id, term.id);

// With:
builder.createTransition(tid('initial-->init'), init.id, s1.id);
builder.createTransition(tid('init-->fork_state'), s1.id, fork.id);
builder.createTransition(tid('fork_state-->RunServiceA'), fork.id, a.id);
builder.createTransition(tid('fork_state-->RunServiceB'), fork.id, b.id);
builder.createTransition(tid('RunServiceA-->join_state'), a.id, join.id);
builder.createTransition(tid('RunServiceB-->join_state'), b.id, join.id);
builder.createTransition(tid('join_state-->ProcessOutcome'), join.id, out.id);
builder.createTransition(tid('ProcessOutcome-->terminal'), out.id, term.id);
```

- [ ] **Step 2: Run test 008**

```bash
cd c:/Users/lassc/Code/typescript/mstate && npx jest test/integration/008 --no-coverage
```

Expected: all tests PASS

---

## Task 7: Update integration test 009 state IDs and transition IDs

**Files:**
- Modify: `test/integration/009.group_execution.test.ts`

This test requires both state ID changes (initial/terminal names) and transition ID changes.

- [ ] **Step 1: Replace the entire `build()` function**

In `test/integration/009.group_execution.test.ts`, replace the `build()` function:

```typescript
function build() {
  const sm        = new BasicStateMachine(smid('groupExample'));
  const builder   = new StateMachineBuilder(sm);
  const rootInit  = builder.createInitial(sid('initial'));
  const group     = builder.createGroup(sid('group'));
  const groupInit = builder.createInitial(sid('group__initial'));
  const step1     = builder.createState(sid('step1'));
  const step2     = builder.createState(sid('step2'));
  const groupTerm = builder.createTerminal(sid('group__terminal'));
  const ch        = builder.createChoice(sid('groupChoice'));
  const logErr    = builder.createState(sid('logError'));
  const rootTerm  = builder.createTerminal(sid('terminal'));

  // Register group members
  group.addState(groupInit);
  group.addState(step1);
  group.addState(step2);
  group.addState(groupTerm);

  // Top-level transitions
  builder.createTransition(tid('initial-->group'), rootInit.id, group.id);
  builder.createTransition(tid('group-->groupChoice'), group.id, ch.id);
  builder.createTransition(tid('groupChoice-->terminal'), ch.id, rootTerm.id);
  builder.createTransition(tid('groupChoice-->logError:error'), ch.id, logErr.id, StateStatus.Error);
  builder.createTransition(tid('logError-->terminal'), logErr.id, rootTerm.id);

  // Group-internal transitions
  builder.createTransition(tid('group__initial-->step1'), groupInit.id, step1.id);
  builder.createTransition(tid('step1-->step2:ok'), step1.id, step2.id, StateStatus.Ok);
  builder.createTransition(tid('step2-->group__terminal:ok'), step2.id, groupTerm.id, StateStatus.Ok);

  return sm;
}
```

- [ ] **Step 2: Run test 009**

```bash
cd c:/Users/lassc/Code/typescript/mstate && npx jest test/integration/009 --no-coverage
```

Expected: all tests PASS

---

## Task 8: Write integration comparison tests

**Files:**
- Create: `test/integration/compare.integration.test.ts`

- [ ] **Step 1: Create the file**

```typescript
// test/integration/compare.integration.test.ts
//
// For each integration scenario (002-009), verifies that the programmatically-built
// state machine matches the equivalent machine parsed from a Mermaid diagram.
//
import { BasicStateMachine } from '../../src/BasicStateMachine';
import { StateMachineBuilder } from '../../src/StateMachineBuilder';
import { MermaidParser } from '../../src/parser/MermaidParser';
import { StateStatus } from '../../src/IState';
import { compareStateMachines } from '../../src/compare';
import type { StateMachineId, StateId, TransitionId } from '../../src/types';

const smid = (s: string) => s as StateMachineId;
const sid  = (s: string) => s as StateId;
const tid  = (s: string) => s as TransitionId;
const parse = (diagram: string) => new MermaidParser().parse(diagram);

// ── 002 — basic single state ──────────────────────────────────────────────

const MERMAID_002 = `
---
title: 002
---
stateDiagram-v2
  [*] --> initialize
  initialize --> [*]
`;

function build002() {
  const sm   = new BasicStateMachine(smid('basicExample'));
  const b    = new StateMachineBuilder(sm);
  const init = b.createInitial(sid('initial'));
  const s1   = b.createState(sid('initialize'));
  const term = b.createTerminal(sid('terminal'));
  b.createTransition(tid('initial-->initialize'), init.id, s1.id);
  b.createTransition(tid('initialize-->terminal'), s1.id, term.id);
  return sm;
}

// ── 003 — basic transition ────────────────────────────────────────────────

const MERMAID_003 = `
---
title: 003
---
stateDiagram-v2
  [*] --> init
  init --> execute
  execute --> [*]
`;

function build003() {
  const sm   = new BasicStateMachine(smid('basicTransition'));
  const b    = new StateMachineBuilder(sm);
  const init = b.createInitial(sid('initial'));
  const s1   = b.createState(sid('init'));
  const s2   = b.createState(sid('execute'));
  const term = b.createTerminal(sid('terminal'));
  b.createTransition(tid('initial-->init'), init.id, s1.id);
  b.createTransition(tid('init-->execute'), s1.id, s2.id);
  b.createTransition(tid('execute-->terminal'), s2.id, term.id);
  return sm;
}

// ── 004 — transition narrowing ────────────────────────────────────────────

const MERMAID_004 = `
---
title: 004
---
stateDiagram-v2
  [*] --> loadConfig
  loadConfig --> execute: ok
  execute --> [*]
`;

function build004() {
  const sm   = new BasicStateMachine(smid('transitionNarrowing'));
  const b    = new StateMachineBuilder(sm);
  const init = b.createInitial(sid('initial'));
  const lc   = b.createState(sid('loadConfig'));
  const exec = b.createState(sid('execute'));
  const term = b.createTerminal(sid('terminal'));
  b.createTransition(tid('initial-->loadConfig'), init.id, lc.id);
  b.createTransition(tid('loadConfig-->execute:ok'), lc.id, exec.id, StateStatus.Ok);
  b.createTransition(tid('execute-->terminal'), exec.id, term.id);
  return sm;
}

// ── 005 — transition selection via Choice ─────────────────────────────────

const MERMAID_005 = `
---
title: 005
---
stateDiagram-v2
  state loadConfigChoice <<choice>>
  [*] --> loadConfig
  loadConfig --> loadConfigChoice
  loadConfigChoice --> execute: ok
  loadConfigChoice --> logError: error
  execute --> [*]
  logError --> [*]
`;

function build005() {
  const sm   = new BasicStateMachine(smid('transitionSelection'));
  const b    = new StateMachineBuilder(sm);
  const init = b.createInitial(sid('initial'));
  const lc   = b.createState(sid('loadConfig'));
  const ch   = b.createChoice(sid('loadConfigChoice'));
  const exec = b.createState(sid('execute'));
  const err  = b.createState(sid('logError'));
  const term = b.createTerminal(sid('terminal'));
  b.createTransition(tid('initial-->loadConfig'), init.id, lc.id);
  b.createTransition(tid('loadConfig-->loadConfigChoice'), lc.id, ch.id);
  b.createTransition(tid('loadConfigChoice-->execute:ok'), ch.id, exec.id, StateStatus.Ok);
  b.createTransition(tid('loadConfigChoice-->logError:error'), ch.id, err.id, StateStatus.Error);
  b.createTransition(tid('execute-->terminal'), exec.id, term.id);
  b.createTransition(tid('logError-->terminal'), err.id, term.id);
  return sm;
}

// ── 006 — transition by exit code ────────────────────────────────────────

const MERMAID_006 = `
---
title: 006
---
stateDiagram-v2
  state ch <<choice>>
  [*] --> loadConfig
  loadConfig --> ch
  ch --> execute_a: Ok/planA
  ch --> execute_b: Ok/planB
  ch --> logError: any
  execute_a --> [*]
  execute_b --> [*]
  logError --> [*]
`;

function build006() {
  const sm   = new BasicStateMachine(smid('exitCode'));
  const b    = new StateMachineBuilder(sm);
  const init = b.createInitial(sid('initial'));
  const lc   = b.createState(sid('loadConfig'));
  const ch   = b.createChoice(sid('ch'));
  const a    = b.createState(sid('execute_a'));
  const bst  = b.createState(sid('execute_b'));
  const err  = b.createState(sid('logError'));
  const term = b.createTerminal(sid('terminal'));
  b.createTransition(tid('initial-->loadConfig'), init.id, lc.id);
  b.createTransition(tid('loadConfig-->ch'), lc.id, ch.id);
  b.createTransition(tid('ch-->execute_a:ok/planA'), ch.id, a.id, StateStatus.Ok, 'planA');
  b.createTransition(tid('ch-->execute_b:ok/planB'), ch.id, bst.id, StateStatus.Ok, 'planB');
  b.createTransition(tid('ch-->logError:any'), ch.id, err.id, StateStatus.AnyStatus);
  b.createTransition(tid('execute_a-->terminal'), a.id, term.id);
  b.createTransition(tid('execute_b-->terminal'), bst.id, term.id);
  b.createTransition(tid('logError-->terminal'), err.id, term.id);
  return sm;
}

// ── 007 — payloads ────────────────────────────────────────────────────────
// Same topology as 003; verifies structural match independent of runtime payloads.

const MERMAID_007 = `
---
title: 007
---
stateDiagram-v2
  [*] --> init
  init --> execute
  execute --> [*]
`;

function build007() {
  const sm   = new BasicStateMachine(smid('payloads'));
  const b    = new StateMachineBuilder(sm);
  const init = b.createInitial(sid('initial'));
  const s1   = b.createState(sid('init'));
  const s2   = b.createState(sid('execute'));
  const term = b.createTerminal(sid('terminal'));
  b.createTransition(tid('initial-->init'), init.id, s1.id);
  b.createTransition(tid('init-->execute'), s1.id, s2.id);
  b.createTransition(tid('execute-->terminal'), s2.id, term.id);
  return sm;
}

// ── 008 — fork/join ───────────────────────────────────────────────────────

const MERMAID_008 = `
---
title: 008
---
stateDiagram-v2
  state fork_state <<fork>>
  state join_state <<join>>
  [*] --> init
  init --> fork_state
  fork_state --> RunServiceA
  fork_state --> RunServiceB
  RunServiceA --> join_state
  RunServiceB --> join_state
  join_state --> ProcessOutcome
  ProcessOutcome --> [*]
`;

function build008() {
  const sm   = new BasicStateMachine(smid('parallelExecution'));
  const b    = new StateMachineBuilder(sm);
  const init = b.createInitial(sid('initial'));
  const s1   = b.createState(sid('init'));
  const fork = b.createFork(sid('fork_state'));
  const a    = b.createState(sid('RunServiceA'));
  const bst  = b.createState(sid('RunServiceB'));
  const join = b.createJoin(sid('join_state'));
  const out  = b.createState(sid('ProcessOutcome'));
  const term = b.createTerminal(sid('terminal'));
  b.createTransition(tid('initial-->init'), init.id, s1.id);
  b.createTransition(tid('init-->fork_state'), s1.id, fork.id);
  b.createTransition(tid('fork_state-->RunServiceA'), fork.id, a.id);
  b.createTransition(tid('fork_state-->RunServiceB'), fork.id, bst.id);
  b.createTransition(tid('RunServiceA-->join_state'), a.id, join.id);
  b.createTransition(tid('RunServiceB-->join_state'), bst.id, join.id);
  b.createTransition(tid('join_state-->ProcessOutcome'), join.id, out.id);
  b.createTransition(tid('ProcessOutcome-->terminal'), out.id, term.id);
  return sm;
}

// ── 009 — group execution ─────────────────────────────────────────────────

const MERMAID_009 = `
---
title: 009
---
stateDiagram-v2
  state groupChoice <<choice>>
  state group {
    [*] --> step1
    step1 --> step2: ok
    step2 --> [*]: ok
  }
  [*] --> group
  group --> groupChoice
  groupChoice --> [*]
  groupChoice --> logError: error
  logError --> [*]
`;

function build009() {
  const sm        = new BasicStateMachine(smid('groupExample'));
  const b         = new StateMachineBuilder(sm);
  const rootInit  = b.createInitial(sid('initial'));
  const group     = b.createGroup(sid('group'));
  const groupInit = b.createInitial(sid('group__initial'));
  const step1     = b.createState(sid('step1'));
  const step2     = b.createState(sid('step2'));
  const groupTerm = b.createTerminal(sid('group__terminal'));
  const ch        = b.createChoice(sid('groupChoice'));
  const logErr    = b.createState(sid('logError'));
  const rootTerm  = b.createTerminal(sid('terminal'));

  group.addState(groupInit);
  group.addState(step1);
  group.addState(step2);
  group.addState(groupTerm);

  b.createTransition(tid('initial-->group'), rootInit.id, group.id);
  b.createTransition(tid('group-->groupChoice'), group.id, ch.id);
  b.createTransition(tid('groupChoice-->terminal'), ch.id, rootTerm.id);
  b.createTransition(tid('groupChoice-->logError:error'), ch.id, logErr.id, StateStatus.Error);
  b.createTransition(tid('logError-->terminal'), logErr.id, rootTerm.id);
  b.createTransition(tid('group__initial-->step1'), groupInit.id, step1.id);
  b.createTransition(tid('step1-->step2:ok'), step1.id, step2.id, StateStatus.Ok);
  b.createTransition(tid('step2-->group__terminal:ok'), step2.id, groupTerm.id, StateStatus.Ok);

  return sm;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('compare integration — builder vs Mermaid parser', () => {
  it('002: basic single state', () => {
    expect(compareStateMachines(build002(), parse(MERMAID_002))).toBe(true);
  });

  it('003: basic transition', () => {
    expect(compareStateMachines(build003(), parse(MERMAID_003))).toBe(true);
  });

  it('004: transition narrowing (ok guard)', () => {
    expect(compareStateMachines(build004(), parse(MERMAID_004))).toBe(true);
  });

  it('005: choice routing', () => {
    expect(compareStateMachines(build005(), parse(MERMAID_005))).toBe(true);
  });

  it('006: exit code routing', () => {
    expect(compareStateMachines(build006(), parse(MERMAID_006))).toBe(true);
  });

  it('007: payload machine topology', () => {
    expect(compareStateMachines(build007(), parse(MERMAID_007))).toBe(true);
  });

  it('008: fork/join', () => {
    expect(compareStateMachines(build008(), parse(MERMAID_008))).toBe(true);
  });

  it('009: group execution', () => {
    expect(compareStateMachines(build009(), parse(MERMAID_009))).toBe(true);
  });
});
```

- [ ] **Step 2: Run comparison integration tests**

```bash
cd c:/Users/lassc/Code/typescript/mstate && npx jest test/integration/compare.integration --no-coverage
```

Expected: all 8 tests PASS

---

## Task 9: Full verification and final commit

**Files:** none (verification only)

- [ ] **Step 1: Run the complete test suite**

```bash
cd c:/Users/lassc/Code/typescript/mstate && npm test
```

Expected: all tests PASS, coverage ≥ 80%

- [ ] **Step 2: Run typecheck and lint**

```bash
cd c:/Users/lassc/Code/typescript/mstate && npm run typecheck && npm run lint
```

Expected: no errors

- [ ] **Step 3: Commit everything**

```bash
cd c:/Users/lassc/Code/typescript/mstate && git add -A && git commit -m "feat: deterministic Mermaid IDs and Mermaid-vs-builder comparison tests"
```

---

## Self-Review

**Spec coverage check:**

| Spec section | Covered by |
|---|---|
| `compareStates` field-by-field | Task 1 (tests) + Task 2 (impl) |
| `compareTransitions` field-by-field | Task 1 (tests) + Task 2 (impl) |
| `compareStateMachines` delegation | Task 1 (tests) + Task 2 (impl) |
| `stateStatus` not compared | Task 1 test: "does not compare stateStatus" |
| `IStateMachine.id` not compared | Task 1 test: "does not compare machine ids" |
| Export from `src/index.ts` | Task 3 |
| Mermaid deterministic IDs (initial/terminal) | Task 4 |
| Mermaid deterministic transition IDs | Task 4 |
| `_counter` removed | Task 4 |
| Integration tests 002-008 updated | Tasks 5-6 |
| Integration test 009 updated (state + transition IDs) | Task 7 |
| Mermaid-vs-builder comparison tests 002-009 | Task 8 |

**Placeholder scan:** No TBDs, todos, or vague steps found. Every step includes concrete code or commands with expected output.

**Type consistency:** `compareStates`, `compareTransitions`, `compareStateMachines` names are consistent across Task 1 (import), Task 2 (export), Task 3 (re-export), and Task 8 (import in integration test).
