// src/__integration__/006.transition_by_exit_code.test.ts
import { BasicStateMachine } from '../../src/base/BasicStateMachine';
import { StateMachineBuilder } from '../../src/base/StateMachineBuilder';
import { StateStatus } from "@src/model/State";
import type { StateMachineId, StateId, TransitionId } from '../../src/model/types';

const smid = (s: string) => s as StateMachineId;
const sid  = (s: string) => s as StateId;
const tid  = (s: string) => s as TransitionId;

function build() {
  const sm   = new BasicStateMachine(smid('exitCode'));
  const builder = new StateMachineBuilder(sm);
  const init = builder.createInitial(sid('initial'));
  const lc   = builder.createState(sid('loadConfig'));
  const ch   = builder.createChoice(sid('ch'));
  const a    = builder.createState(sid('execute_a'));
  const b    = builder.createState(sid('execute_b'));
  const err  = builder.createState(sid('logError'));
  const term = builder.createTerminal(sid('terminal'));
  builder.createTransition(tid('initial-->loadConfig'), init.id, lc.id);
  builder.createTransition(tid('loadConfig-->ch'), lc.id, ch.id);
  builder.createTransition(tid('ch-->execute_a:ok/planA'), ch.id, a.id, StateStatus.Ok, 'planA');
  builder.createTransition(tid('ch-->execute_b:ok/planB'), ch.id, b.id, StateStatus.Ok, 'planB');
  builder.createTransition(tid('ch-->logError:any'), ch.id, err.id, StateStatus.AnyStatus);
  builder.createTransition(tid('execute_a-->terminal'), a.id, term.id);
  builder.createTransition(tid('execute_b-->terminal'), b.id, term.id);
  builder.createTransition(tid('logError-->terminal'), err.id, term.id);
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
