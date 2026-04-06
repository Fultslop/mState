// src/__integration__/004.transition_narrowing.test.ts
import { StateMachine } from '../../src/StateMachine';
import { SMStatus } from '../../src/types';
import type { SMStateMachineId, SMStateId, SMTransitionId } from '../../src/types';

const smid = (s: string) => s as SMStateMachineId;
const sid  = (s: string) => s as SMStateId;
const tid  = (s: string) => s as SMTransitionId;

function build() {
  const sm   = new StateMachine(smid('transitionNarrowing'));
  const init = sm.createInitial(sid('initial'));
  const lc   = sm.createState(sid('loadConfig'));
  const exec = sm.createState(sid('execute'));
  const term = sm.createTerminal(sid('terminal'));
  sm.createTransition(tid('t0'), init.id, lc.id);
  sm.createTransition(tid('t1'), lc.id, exec.id, SMStatus.Ok);
  sm.createTransition(tid('t2'), exec.id, term.id);
  return sm;
}

describe('spec 004 — transition narrowing', () => {
  it('follows narrowed transition when status matches', () => {
    const sm = build();
    sm.start();
    const started: string[] = [];
    sm.onStateStart.add(e => {
      const evt = Array.isArray(e) ? e[0]! : e;
      started.push(String(evt.toStateId));
    });
    sm.onStopped(sid('loadConfig'), SMStatus.Ok);
    expect(started).toContain('execute');
  });

  it('exits machine with Error when narrowed transition does not match', () => {
    const sm = build();
    sm.start();
    const smStopped: SMStatus[] = [];
    sm.onSMStopped.add(e => smStopped.push(e.stateStatus));
    sm.onStopped(sid('loadConfig'), SMStatus.Error);
    expect(smStopped[0]).toBe(SMStatus.Error);
  });

  it('does not emit onStateStart for execute when narrowing fails', () => {
    const sm = build();
    sm.start();
    const started: string[] = [];
    sm.onStateStart.add(e => {
      const evt = Array.isArray(e) ? e[0]! : e;
      started.push(String(evt.toStateId));
    });
    sm.onStopped(sid('loadConfig'), SMStatus.Error);
    expect(started).not.toContain('execute');
  });
});
