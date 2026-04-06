// src/__integration__/005.transition_selection.test.ts
import { BasicStateMachine } from '../../src/base/BasicStateMachine';
import { StateMachineBuilder } from '../../src/base/StateMachineBuilder';
import { StateStatus } from "@src/model/State";
import type { StateMachineId, StateId, TransitionId } from '../../src/model/types';

const smid = (s: string) => s as StateMachineId;
const sid  = (s: string) => s as StateId;
const tid  = (s: string) => s as TransitionId;

function build() {
  const sm   = new BasicStateMachine(smid('transitionSelection'));
  const builder = new StateMachineBuilder(sm);
  const init = builder.createInitial(sid('initial'));
  const lc   = builder.createState(sid('loadConfig'));
  const ch   = builder.createChoice(sid('loadConfigChoice'));
  const exec = builder.createState(sid('execute'));
  const err  = builder.createState(sid('logError'));
  const term = builder.createTerminal(sid('terminal'));
  builder.createTransition(tid('initial-->loadConfig'), init.id, lc.id);
  builder.createTransition(tid('loadConfig-->loadConfigChoice'), lc.id, ch.id);
  builder.createTransition(tid('loadConfigChoice-->execute:ok'), ch.id, exec.id, StateStatus.Ok);
  builder.createTransition(tid('loadConfigChoice-->logError:error'), ch.id, err.id, StateStatus.Error);
  builder.createTransition(tid('execute-->terminal'), exec.id, term.id);
  builder.createTransition(tid('logError-->terminal'), err.id, term.id);
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
    sm.onStopped(sid('loadConfig'), StateStatus.Ok);
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
    sm.onStopped(sid('loadConfig'), StateStatus.Error);
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
    sm.onStopped(sid('loadConfig'), StateStatus.Ok);
    expect(starts).not.toContain('loadConfigChoice');
    expect(stopped).not.toContain('loadConfigChoice');
  });

  it('default (unlabeled) branch catches any other status', () => {
    const sm   = new BasicStateMachine(smid('defaultBranch'));
    const builder = new StateMachineBuilder(sm);
    const init = builder.createInitial(sid('initial'));
    const lc   = builder.createState(sid('lc'));
    const ch   = builder.createChoice(sid('ch'));
    const exec = builder.createState(sid('exec'));
    const def  = builder.createState(sid('default'));
    const term = builder.createTerminal(sid('term'));
    builder.createTransition(tid('initial-->lc'), init.id, lc.id);
    builder.createTransition(tid('lc-->ch'), lc.id, ch.id);
    builder.createTransition(tid('ch-->exec:ok'), ch.id, exec.id, StateStatus.Ok);
    builder.createTransition(tid('ch-->default'), ch.id, def.id);
    builder.createTransition(tid('exec-->term'), exec.id, term.id);
    builder.createTransition(tid('default-->term'), def.id, term.id);

    sm.start();
    const started: string[] = [];
    sm.onStateStart.add(e => {
      const evt = Array.isArray(e) ? e[0]! : e;
      started.push(String(evt.toStateId));
    });
    sm.onStopped(sid('lc'), StateStatus.Exception);
    expect(started).toContain('default');
    expect(started).not.toContain('exec');
  });
});
