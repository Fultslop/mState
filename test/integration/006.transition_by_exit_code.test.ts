// src/__integration__/006.transition_by_exit_code.test.ts
import { BasicStateMachine } from '../../src/BasicStateMachine';
import { StateStatus } from "@src/IState";
import type { StateMachineId, StateId, TransitionId } from '../../src/types';

const smid = (s: string) => s as StateMachineId;
const sid  = (s: string) => s as StateId;
const tid  = (s: string) => s as TransitionId;

function build() {
  const sm   = new BasicStateMachine(smid('exitCode'));
  const init = sm.createInitial(sid('initial'));
  const lc   = sm.createState(sid('loadConfig'));
  const ch   = sm.createChoice(sid('ch'));
  const a    = sm.createState(sid('execute_a'));
  const b    = sm.createState(sid('execute_b'));
  const err  = sm.createState(sid('logError'));
  const term = sm.createTerminal(sid('terminal'));
  sm.createTransition(tid('t0'), init.id, lc.id);
  sm.createTransition(tid('t1'), lc.id, ch.id);
  sm.createTransition(tid('t2'), ch.id, a.id, StateStatus.Ok, 'planA');
  sm.createTransition(tid('t3'), ch.id, b.id, StateStatus.Ok, 'planB');
  sm.createTransition(tid('t4'), ch.id, err.id, StateStatus.AnyStatus);
  sm.createTransition(tid('t5'), a.id, term.id);
  sm.createTransition(tid('t6'), b.id, term.id);
  sm.createTransition(tid('t7'), err.id, term.id);
  return sm;
}

describe('spec 006 — transition by exit code', () => {
  it('routes to execute_a when status=Ok exitCode=planA', () => {
    const sm = build();
    sm.start();
    const started: string[] = [];
    sm.onStateStart.add(e => {
      const evt = Array.isArray(e) ? e[0]! : e;
      started.push(String(evt.toStateId));
    });
    sm.onStopped(sid('loadConfig'), StateStatus.Ok, 'planA');
    expect(started).toContain('execute_a');
    expect(started).not.toContain('execute_b');
    expect(started).not.toContain('logError');
  });

  it('routes to execute_b when status=Ok exitCode=planB', () => {
    const sm = build();
    sm.start();
    const started: string[] = [];
    sm.onStateStart.add(e => {
      const evt = Array.isArray(e) ? e[0]! : e;
      started.push(String(evt.toStateId));
    });
    sm.onStopped(sid('loadConfig'), StateStatus.Ok, 'planB');
    expect(started).toContain('execute_b');
    expect(started).not.toContain('execute_a');
  });

  it('routes to logError via AnyStatus catch-all for Error status', () => {
    const sm = build();
    sm.start();
    const started: string[] = [];
    sm.onStateStart.add(e => {
      const evt = Array.isArray(e) ? e[0]! : e;
      started.push(String(evt.toStateId));
    });
    sm.onStopped(sid('loadConfig'), StateStatus.Error);
    expect(started).toContain('logError');
  });
});
