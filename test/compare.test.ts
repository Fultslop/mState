import { BasicStateMachine } from '@src/base/BasicStateMachine';
import { StateMachineBuilder } from '@src/base/StateMachineBuilder';
import { StateStatus, StateType } from '@src/model/State';
import { UserDefinedState } from '@src/base/UserDefinedState';
import { compareStates, compareTransitions, compareStateMachines } from '@src/base/compare';
import type { StateId, TransitionId, StateMachineId } from '@src/model/types';
import { BasicTransition } from '@src/base/BasicTransition';

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
    return new BasicTransition(
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
