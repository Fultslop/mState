import { BasicStateMachine } from '@src/BasicStateMachine';
import { StateMachineBuilder } from '@src/StateMachineBuilder';
import type { StateMachineId, StateId, TransitionId } from '@src/types';
import type { IGroupState } from '@src/IGroupState';

const smid = (s: string) => s as StateMachineId;
const sid  = (s: string) => s as StateId;
const tid  = (s: string) => s as TransitionId;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** init ──t0──► a ──t1──► b ──t2──► term */
function makeChain() {
  const sm      = new BasicStateMachine(smid('sm'));
  const builder = new StateMachineBuilder(sm);
  const init    = builder.createInitial(sid('init'));
  const a       = builder.createState(sid('a'));
  const b       = builder.createState(sid('b'));
  const term    = builder.createTerminal(sid('term'));
  builder.createTransition(tid('t0'), init.id, a.id);
  builder.createTransition(tid('t1'), a.id,    b.id);
  builder.createTransition(tid('t2'), b.id,    term.id);
  return { sm, builder, init, a, b, term };
}

/**
 * rootInit ──t0──► group ──t1──► rootTerm
 *                    │
 *              groupInit ──gi0──► step1 ──gi1──► groupTerm
 *
 * The group-internal transition gi0 is also registered in group.transitionIds.
 */
function makeGroupSM() {
  const sm        = new BasicStateMachine(smid('sm'));
  const builder   = new StateMachineBuilder(sm);
  const rootInit  = builder.createInitial(sid('rootInit'));
  const group     = builder.createGroup(sid('group')) as IGroupState;
  const groupInit = builder.createInitial(sid('groupInit'));
  const step1     = builder.createState(sid('step1'));
  const groupTerm = builder.createTerminal(sid('groupTerm'));
  const rootTerm  = builder.createTerminal(sid('rootTerm'));

  // Wire group membership
  group.addState(groupInit);
  group.addState(step1);
  group.addState(groupTerm);

  // Top-level transitions
  builder.createTransition(tid('t0'), rootInit.id, group.id);
  builder.createTransition(tid('t1'), group.id,    rootTerm.id);

  // Group-internal transitions (also tracked by the group)
  const gi0 = builder.createTransition(tid('gi0'), groupInit.id, step1.id,    undefined, undefined, group.id);
  const gi1 = builder.createTransition(tid('gi1'), step1.id,     groupTerm.id, undefined, undefined, group.id);
  group.addTransition(gi0);
  group.addTransition(gi1);

  return { sm, builder, rootInit, group, groupInit, step1, groupTerm, rootTerm };
}

// ── deleteTransition ──────────────────────────────────────────────────────────

describe('deleteTransition — cascade', () => {
  it('removes the transition from the registry', () => {
    const { sm } = makeChain();
    sm.deleteTransition(tid('t1'));
    expect(sm.getTransition(tid('t1'))).toBeUndefined();
    expect(sm.getTransitionCount()).toBe(2);
  });

  it("removes the transition id from the fromState's outgoing set", () => {
    const { sm, a } = makeChain();
    sm.deleteTransition(tid('t1')); // t1: a → b
    expect(a.outgoing.has(tid('t1'))).toBe(false);
  });

  it("removes the transition id from the toState's incoming set", () => {
    const { sm, b } = makeChain();
    sm.deleteTransition(tid('t1')); // t1: a → b
    expect(b.incoming.has(tid('t1'))).toBe(false);
  });

  it("removes the transition id from the parent GroupState's transitionIds", () => {
    const { sm, group } = makeGroupSM();
    sm.deleteTransition(tid('gi0'));
    expect(group.transitionIds.has(tid('gi0'))).toBe(false);
  });

  it('leaves transitions that belong to other states untouched', () => {
    const { sm, init, b } = makeChain();
    sm.deleteTransition(tid('t1')); // t1: a → b
    expect(init.outgoing.has(tid('t0'))).toBe(true);
    expect(b.outgoing.has(tid('t2'))).toBe(true);
    expect(sm.getTransitionCount()).toBe(2);
  });
});

// ── deleteState ───────────────────────────────────────────────────────────────

describe('deleteState — cascade', () => {
  it('removes the state from the registry', () => {
    const { sm } = makeChain();
    sm.deleteState(sid('a'));
    expect(sm.getState(sid('a'))).toBeUndefined();
  });

  it('removes all outgoing transitions from the registry', () => {
    const { sm } = makeChain();
    sm.deleteState(sid('a')); // a has outgoing t1
    expect(sm.getTransition(tid('t1'))).toBeUndefined();
  });

  it('removes all incoming transitions from the registry', () => {
    const { sm } = makeChain();
    sm.deleteState(sid('a')); // a has incoming t0
    expect(sm.getTransition(tid('t0'))).toBeUndefined();
  });

  it("removes incoming transition id from the predecessor's outgoing set", () => {
    const { sm, init } = makeChain();
    sm.deleteState(sid('a')); // t0: init → a
    expect(init.outgoing.has(tid('t0'))).toBe(false);
  });

  it("removes outgoing transition id from the successor's incoming set", () => {
    const { sm, b } = makeChain();
    sm.deleteState(sid('a')); // t1: a → b
    expect(b.incoming.has(tid('t1'))).toBe(false);
  });

  it('removes the state id from its parent GroupState', () => {
    const { sm, group } = makeGroupSM();
    sm.deleteState(sid('step1'));
    expect(group.stateIds.has(sid('step1'))).toBe(false);
  });

  it('leaves unrelated states and transitions untouched', () => {
    const { sm, b, term } = makeChain();
    sm.deleteState(sid('a'));
    expect(sm.getState(sid('b'))).toBe(b);
    expect(sm.getTransition(tid('t2'))).toBeDefined();
    expect(b.outgoing.has(tid('t2'))).toBe(true);
    expect(term.incoming.has(tid('t2'))).toBe(true);
  });
});

// ── deleteState on GroupState ─────────────────────────────────────────────────

describe('deleteState on GroupState — cascade deletes all children', () => {
  it('removes the group state itself from the registry', () => {
    const { sm } = makeGroupSM();
    sm.deleteState(sid('group'));
    expect(sm.getState(sid('group'))).toBeUndefined();
  });

  it('removes all child states from the registry', () => {
    const { sm } = makeGroupSM();
    sm.deleteState(sid('group'));
    expect(sm.getState(sid('groupInit'))).toBeUndefined();
    expect(sm.getState(sid('step1'))).toBeUndefined();
    expect(sm.getState(sid('groupTerm'))).toBeUndefined();
  });

  it('removes all group-internal transitions from the registry', () => {
    const { sm } = makeGroupSM();
    sm.deleteState(sid('group'));
    expect(sm.getTransition(tid('gi0'))).toBeUndefined();
    expect(sm.getTransition(tid('gi1'))).toBeUndefined();
  });

  it('removes the top-level transitions that connected to the group', () => {
    const { sm } = makeGroupSM();
    sm.deleteState(sid('group'));
    expect(sm.getTransition(tid('t0'))).toBeUndefined();
    expect(sm.getTransition(tid('t1'))).toBeUndefined();
  });

  it('leaves rootInit and rootTerm and their remaining connections intact', () => {
    const { sm, rootInit, rootTerm } = makeGroupSM();
    sm.deleteState(sid('group'));
    expect(sm.getState(sid('rootInit'))).toBe(rootInit);
    expect(sm.getState(sid('rootTerm'))).toBe(rootTerm);
    // Their outgoing/incoming sets should no longer reference the deleted transitions
    expect(rootInit.outgoing.has(tid('t0'))).toBe(false);
    expect(rootTerm.incoming.has(tid('t1'))).toBe(false);
  });

  it('results in only rootInit and rootTerm remaining in the registry', () => {
    const { sm } = makeGroupSM();
    sm.deleteState(sid('group'));
    expect(sm.getStateCount()).toBe(2);
    expect(sm.getTransitionCount()).toBe(0);
  });
});
