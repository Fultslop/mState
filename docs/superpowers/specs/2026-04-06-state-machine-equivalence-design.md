# State Machine Equivalence Design

**Date:** 2026-04-06  
**Status:** Approved

## Goal

Provide a TypeScript API for testing structural equivalence between two state machines, and use it to verify that programmatically-built integration test machines match their Mermaid-parsed counterparts.

---

## 1. API Surface

New file: `src/compare.ts`

```ts
export function compareStates(a: IState, b: IState): boolean
export function compareTransitions(a: ITransition, b: ITransition): boolean
export function compareStateMachines(a: IStateMachine, b: IStateMachine): boolean
```

All three exported from `src/index.ts`.

---

## 2. Comparison Logic

### `compareStates(a, b)`

All of the following must hold:

1. `a.id === b.id`
2. `a.type === b.type`
3. `a.parentId === b.parentId`
4. `a.incoming` and `b.incoming` contain the same `TransitionId` values (set equality, order-independent)
5. `a.outgoing` and `b.outgoing` — same
6. `a.config` deep-equals `b.config` via sorted `JSON.stringify`

`stateStatus` is **not** compared — it is runtime state, not structural definition.

### `compareTransitions(a, b)`

All of the following must hold:

1. `a.id === b.id`
2. `a.fromStateId === b.fromStateId`
3. `a.toStateId === b.toStateId`
4. `a.status === b.status`
5. `a.exitCode === b.exitCode`
6. `a.parentId === b.parentId`

### `compareStateMachines(a, b)`

1. `a.getStateCount() === b.getStateCount()`
2. `a.getTransitionCount() === b.getTransitionCount()`
3. For every `id` in `a.getStateIds()`: `b.getState(id)` exists and `compareStates` returns `true`
4. For every `id` in `b.getStateIds()`: `a.getState(id)` exists (catches states only in `b`)
5. Same logic for transitions

`IStateMachine.id` is **not** compared — two machines with different IDs but identical graphs are equivalent.

---

## 3. Unit Tests

File: `src/compare.spec.ts` (co-located with source, per project convention)

### `compareStates`
- Identical states → `true`
- Differing `id` → `false`
- Differing `type` → `false`
- Differing `parentId` → `false`
- Differing `config` (including nested values, key order) → `false`
- Differing `incoming` set → `false`
- Differing `outgoing` set → `false`

### `compareTransitions`
- Identical transitions → `true`
- Differing each field individually → `false`
- `status === undefined` vs `status === StateStatus.Ok` → `false`
- `exitCode === undefined` vs `exitCode === 'done'` → `false`

### `compareStateMachines`
- Two machines built identically → `true`
- One extra state in `b` → `false`
- One extra transition in `b` → `false`
- Same states/transitions but one field differs → `false`

---

## 4. Mermaid Parser — Deterministic IDs

The parser currently uses a module-level counter (`_counter`) to generate IDs for implicit states and transitions. This makes IDs non-deterministic across test runs and incompatible with builder-constructed machines.

**Replacement rules:**

| Entity | Old ID | New ID |
|---|---|---|
| Root initial state | `init#N` | `initial` |
| Root terminal state | `term#N` | `terminal` |
| Group initial state | `${group}_init#N` | `${groupId}__initial` |
| Group terminal state | `${group}_term#N` | `${groupId}__terminal` |
| Transition | `t#N` | `${fromId}-->${toId}` |

**Multiple transitions between the same state pair** (e.g., a Choice with two guarded exits to the same target): append the guard to keep the ID unique:

```
${fromId}-->${toId}:${status ?? ''}/${exitCode ?? ''}
```

The module-level `_counter` and `nextId()` helper are removed entirely.

The integration tests' `buildSM()` functions are updated to use IDs matching the new scheme. For most tests only transition IDs change (e.g., `t0` → `initial-->initialize`). State IDs in existing tests already use names that match (`initial`, `terminal`, and named user states).

---

## 5. Integration Comparison Tests

New file: `test/integration/compare.integration.test.ts`

For each integration scenario (002–009), one test:
1. Calls the scenario's `buildSM()` (updated to use deterministic IDs)
2. Parses the equivalent Mermaid diagram via `MermaidParser`
3. Asserts `compareStateMachines(built, parsed) === true`

Mermaid diagrams are inline string constants in the test file, following the same pattern as `test/parser/MermaidParser.test.ts`.

Scenarios covered:
- 002 — basic single state
- 003 — basic transition
- 004 — transition narrowing (status guards)
- 005 — transition selection (choice)
- 006 — transition by exit code
- 007 — payloads (structure only, no payload values)
- 008 — fork/join
- 009 — group execution

---

## Files Changed

| File | Change |
|---|---|
| `src/compare.ts` | New — three comparator functions |
| `src/index.ts` | Export the three comparators |
| `src/parser/MermaidParser.ts` | Replace counter-based IDs with deterministic IDs |
| `src/compare.spec.ts` | New — unit tests for all three comparators |
| `test/integration/002–009.*.test.ts` | Update transition IDs to match new scheme |
| `test/integration/compare.integration.test.ts` | New — Mermaid-vs-builder comparison tests |
