import { StateStatus } from "@src/model/State";
import type { StateId, TransitionId, StateMachineId } from '@src/model/types';
import { StateRegistry } from '@src/base/StateRegistry';
import { TransitionRegistry } from '@src/base/TransitionRegistry';
import { validateStateMachine } from "@src/base/Validator";
import { SMValidationException } from "@src/base/SMValidationException";
import { BasicTransition } from '@src/base/BasicTransition';
import { InitialState } from '@src/base/InitialState';
import { TerminalState } from '@src/base/TerminalState';
import { UserDefinedState } from '@src/base/UserDefinedState';
import { ChoiceState } from '@src/base/ChoiceState';
import { ForkState } from '@src/base/ForkState';
import { BasicJoinState } from '@src/base/BasicJoinState';
import { BasicStateMachine } from '@src/base/BasicStateMachine';
import { StateMachineBuilder } from '@src/base/StateMachineBuilder';
import { ParallelState } from '@src/base/ParallelState';

const sid = (s: string) => s as StateId;
const tid = (s: string) => s as TransitionId;

function makeVaidSM() {
  const sr = new StateRegistry();
  const tr = new TransitionRegistry();

  const init = new InitialState(sid('init'));
  const s1   = new UserDefinedState(sid('s1'));
  const term = new TerminalState(sid('term'));

  sr.add(init); sr.add(s1); sr.add(term);

  const t0 = new BasicTransition(tid('t0'), sid('init'), sid('s1'));
  const t1 = new BasicTransition(tid('t1'), sid('s1'), sid('term'));
  tr.add(t0); tr.add(t1);
  init.outgoing.add(tid('t0')); s1.incoming.add(tid('t0'));
  s1.outgoing.add(tid('t1')); term.incoming.add(tid('t1'));

  return { sr, tr };
}

describe('Validator', () => {
  it('passes a valid minimal state machine', () => {
    const { sr, tr } = makeVaidSM();
    expect(() => validateStateMachine(sr, tr)).not.toThrow();
  });

  // Rule 1: exactly one Initial
  it('rule 1: throws when there is no Initial state', () => {
    const sr = new StateRegistry();
    const tr = new TransitionRegistry();
    sr.add(new UserDefinedState(sid('s1')));
    expect(() => validateStateMachine(sr, tr)).toThrow(SMValidationException);
  });

  it('rule 1: throws when there are two top-level Initial states', () => {
    const sr = new StateRegistry();
    const tr = new TransitionRegistry();
    sr.add(new InitialState(sid('i1')));
    sr.add(new InitialState(sid('i2')));
    sr.add(new TerminalState(sid('term')));
    expect(() => validateStateMachine(sr, tr)).toThrow(SMValidationException);
  });

  // Rule 3: all states reachable
  it('rule 3: throws for unreachable state', () => {
    const { sr, tr } = makeVaidSM();
    sr.add(new UserDefinedState(sid('orphan')));
    expect(() => validateStateMachine(sr, tr)).toThrow(SMValidationException);
  });

  // Rule 5: transition references valid state ids
  it('rule 5: throws when transition references unknown state', () => {
    const sr = new StateRegistry();
    const tr = new TransitionRegistry();
    sr.add(new InitialState(sid('init')));
    sr.add(new TerminalState(sid('term')));
    const t = new BasicTransition(tid('t0'), sid('init'), sid('ghost'));
    tr.add(t);
    sr.get(sid('init'))!.outgoing.add(tid('t0'));
    expect(() => validateStateMachine(sr, tr)).toThrow(SMValidationException);
  });

  // Rule 7: Choice must have outgoing transitions
  it('rule 7: throws for Choice with no outgoing transitions', () => {
    const { sr, tr } = makeVaidSM();
    const ch = new ChoiceState(sid('ch'));
    sr.add(ch);
    // Add transition to choice but none from it
    const t = new BasicTransition(tid('t_ch'), sid('s1'), sid('ch'));
    tr.add(t);
    sr.get(sid('s1'))!.outgoing.delete(tid('t1')); // remove old outgoing
    sr.get(sid('s1'))!.outgoing.add(tid('t_ch'));
    ch.incoming.add(tid('t_ch'));
    expect(() => validateStateMachine(sr, tr)).toThrow(SMValidationException);
  });

  // Rule 8: no duplicate (status, exitCode) on Choice outgoing
  it('rule 8: throws for duplicate status on Choice outgoing transitions', () => {
    const sr = new StateRegistry();
    const tr = new TransitionRegistry();
    const init = new InitialState(sid('init'));
    const ch   = new ChoiceState(sid('ch'));
    const b    = new UserDefinedState(sid('b'));
    const c    = new UserDefinedState(sid('c'));
    const term = new TerminalState(sid('term'));
    sr.add(init); sr.add(ch); sr.add(b); sr.add(c); sr.add(term);

    const t0 = new BasicTransition(tid('t0'), sid('init'), sid('ch'));
    const t1 = new BasicTransition(tid('t1'), sid('ch'), sid('b'), StateStatus.Ok);
    const t2 = new BasicTransition(tid('t2'), sid('ch'), sid('c'), StateStatus.Ok); // dup!
    const t3 = new BasicTransition(tid('t3'), sid('b'), sid('term'));
    const t4 = new BasicTransition(tid('t4'), sid('c'), sid('term'));
    for (const t of [t0, t1, t2, t3, t4]) tr.add(t);
    init.outgoing.add(tid('t0')); ch.incoming.add(tid('t0'));
    ch.outgoing.add(tid('t1')); b.incoming.add(tid('t1'));
    ch.outgoing.add(tid('t2')); c.incoming.add(tid('t2'));
    b.outgoing.add(tid('t3')); term.incoming.add(tid('t3'));
    c.outgoing.add(tid('t4')); term.incoming.add(tid('t4'));

    expect(() => validateStateMachine(sr, tr)).toThrow(SMValidationException);
  });

  // Rule 10: fork branch must reach a Join before Terminal
  it('rule 10: throws when fork branch goes directly to Terminal', () => {
    const sr = new StateRegistry();
    const tr = new TransitionRegistry();
    const init = new InitialState(sid('init'));
    const fork = new ForkState(sid('fork'));
    const a    = new UserDefinedState(sid('a'));
    const b    = new UserDefinedState(sid('b'));
    const join = new BasicJoinState(sid('join'));
    const out  = new UserDefinedState(sid('out'));
    const term = new TerminalState(sid('term'));
    sr.add(init); sr.add(fork); sr.add(a); sr.add(b); sr.add(join); sr.add(out); sr.add(term);

    const transitions = [
      new BasicTransition(tid('t0'), sid('init'), sid('fork')),
      new BasicTransition(tid('t1'), sid('fork'), sid('a')),
      new BasicTransition(tid('t2'), sid('fork'), sid('b')),
      new BasicTransition(tid('t3'), sid('a'), sid('join')),
      new BasicTransition(tid('t4'), sid('b'), sid('term')), // violation: goes to terminal, not join
      new BasicTransition(tid('t5'), sid('join'), sid('out')),
      new BasicTransition(tid('t6'), sid('out'), sid('term')),
    ];
    for (const t of transitions) {
      tr.add(t);
      sr.get(t.fromStateId)!.outgoing.add(t.id);
      sr.get(t.toStateId)!.incoming.add(t.id);
    }
    join.incoming.delete(tid('t4')); // b goes to term, not join

    expect(() => validateStateMachine(sr, tr)).toThrow(SMValidationException);
  });

  // Rule 16: AnyStatus cannot have exitCode
  it('rule 16: throws for AnyStatus combined with exitCode', () => {
    const { sr, tr } = makeVaidSM();
    // add a bad transition
    const extra = new UserDefinedState(sid('extra'));
    sr.add(extra);
    const badT = new BasicTransition(tid('bad'), sid('s1'), sid('extra'), StateStatus.AnyStatus, 'code');
    tr.add(badT);
    sr.get(sid('s1'))!.outgoing.add(tid('bad'));
    extra.incoming.add(tid('bad'));
    extra.outgoing.add(tid('t1')); // re-use existing terminal transition (just add outgoing)
    expect(() => validateStateMachine(sr, tr)).toThrow(SMValidationException);
  });
});

describe('parallel validation', () => {
  const smid = (s: string) => s as StateMachineId;

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
    const { sm, b, ps } = buildValidParallel();
    // Add a second region with no initial - create a fresh parallel with a bad region
    const r3 = ps.createRegion('r3');
    const rs3 = b.createState(sid('rs3'));
    b.createTransition(tid('rt5'), rs3.id, r3.terminal.id);
    r3.addState(rs3);
    // r3 has no Initial → P1 should fail
    expect(() => sm.validate()).toThrow(/P1.*region.*initial/i);
  });

  it('P2: region with no terminal throws', () => {
    const { sm, r1 } = buildValidParallel();
    sm.deleteState(r1.terminal.id);
    expect(() => sm.validate()).toThrow(/P2.*region.*terminal/i);
  });

  it('P3: cross-region transition throws', () => {
    const { sm, b, r1, r2 } = buildValidParallel();
    const cross = b.createTransition(tid('cross'), sid('rs1'), sid('rs2'));
    r1.addTransition(cross);
    expect(() => sm.validate()).toThrow(/P3.*cross.*region/i);
  });

  it('P4: parallel directly followed by Choice throws', () => {
    const { sm, b, ps } = buildValidParallel();
    const ch = b.createChoice(sid('ch1'));
    const term2 = b.createTerminal(sid('term2'));
    b.createTransition(tid('bad'), ps.id, ch.id);
    b.createTransition(tid('ch_out'), ch.id, term2.id);
    expect(() => sm.validate()).toThrow(/P4.*choice/i);
  });

  it('P5: region state transitioning to outer terminal throws', () => {
    const { sm, b, r1 } = buildValidParallel();
    b.createTransition(tid('bypass'), sid('rs1'), sid('term'));
    r1.addState(sm.getState(sid('rs1'))!);
    expect(() => sm.validate()).toThrow(/P5.*outer terminal/i);
  });
});
