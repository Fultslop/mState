// src/__integration__/005.transition_selection.test.ts
import { StateMachine } from '../../src/StateMachine';
import { SMStatus } from '../../src/types';
import type { SMStateMachineId, SMStateId, SMTransitionId } from '../../src/types';

const smid = (s: string) => s as SMStateMachineId;
const sid  = (s: string) => s as SMStateId;
const tid  = (s: string) => s as SMTransitionId;

function build() {
  const sm   = new StateMachine(smid('transitionSelection'));
  const init = sm.createInitial(sid('initial'));
  const lc   = sm.createState(sid('loadConfig'));
  const ch   = sm.createChoice(sid('loadConfigChoice'));
  const exec = sm.createState(sid('execute'));
  const err  = sm.createState(sid('logError'));
  const term = sm.createTerminal(sid('terminal'));
  sm.createTransition(tid('t0'), init.id, lc.id);
  sm.createTransition(tid('t1'), lc.id, ch.id);
  sm.createTransition(tid('t2'), ch.id, exec.id, SMStatus.Ok);
  sm.createTransition(tid('t3'), ch.id, err.id, SMStatus.Error);
  sm.createTransition(tid('t4'), exec.id, term.id);
  sm.createTransition(tid('t5'), err.id, term.id);
  return sm;
}

describe('spec 005 — transition selection via Choice', () => {
  it('routes to execute when loadConfig exits with Ok', () => {
    const sm = build();
    sm.start();
    const started: string[] = [];
    sm.onStateStart.add(e => {
      const evt = Array.isArray(e) ? e[0]! : e;
      started.push(String(evt.toStateId));
    });
    sm.onStopped(sid('loadConfig'), SMStatus.Ok);
    expect(started).toContain('execute');
    expect(started).not.toContain('logError');
  });

  it('routes to logError when loadConfig exits with Error', () => {
    const sm = build();
    sm.start();
    const started: string[] = [];
    sm.onStateStart.add(e => {
      const evt = Array.isArray(e) ? e[0]! : e;
      started.push(String(evt.toStateId));
    });
    sm.onStopped(sid('loadConfig'), SMStatus.Error);
    expect(started).toContain('logError');
    expect(started).not.toContain('execute');
  });

  it('no onStateStart or onStateStopped emitted for the Choice node itself', () => {
    const sm = build();
    sm.start();
    const starts:  string[] = [];
    const stopped: string[] = [];
    sm.onStateStart.add(e => {
      const evt = Array.isArray(e) ? e[0]! : e;
      starts.push(String(evt.toStateId));
    });
    sm.onStateStopped.add(e => stopped.push(String(e.stateId)));
    sm.onStopped(sid('loadConfig'), SMStatus.Ok);
    expect(starts).not.toContain('loadConfigChoice');
    expect(stopped).not.toContain('loadConfigChoice');
  });

  it('default (unlabeled) branch catches any other status', () => {
    const sm   = new StateMachine(smid('defaultBranch'));
    const init = sm.createInitial(sid('initial'));
    const lc   = sm.createState(sid('lc'));
    const ch   = sm.createChoice(sid('ch'));
    const exec = sm.createState(sid('exec'));
    const def  = sm.createState(sid('default'));
    const term = sm.createTerminal(sid('term'));
    sm.createTransition(tid('t0'), init.id, lc.id);
    sm.createTransition(tid('t1'), lc.id, ch.id);
    sm.createTransition(tid('t2'), ch.id, exec.id, SMStatus.Ok);
    sm.createTransition(tid('t3'), ch.id, def.id);
    sm.createTransition(tid('t4'), exec.id, term.id);
    sm.createTransition(tid('t5'), def.id, term.id);

    sm.start();
    const started: string[] = [];
    sm.onStateStart.add(e => {
      const evt = Array.isArray(e) ? e[0]! : e;
      started.push(String(evt.toStateId));
    });
    sm.onStopped(sid('lc'), SMStatus.Exception);
    expect(started).toContain('default');
    expect(started).not.toContain('exec');
  });
});
