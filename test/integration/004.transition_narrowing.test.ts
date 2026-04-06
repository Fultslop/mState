// src/__integration__/004.transition_narrowing.test.ts
import { BasicStateMachine } from '../../src/BasicStateMachine';
import { StateMachineBuilder } from '../../src/StateMachineBuilder';
import { StateStatus } from "@src/IState";
import type { StateMachineId, StateId, TransitionId } from '../../src/types';

const smid = (s: string) => s as StateMachineId;
const sid  = (s: string) => s as StateId;
const tid  = (s: string) => s as TransitionId;

function build() {
  const sm   = new BasicStateMachine(smid('transitionNarrowing'));
  const builder = new StateMachineBuilder(sm);
  const init = builder.createInitial(sid('initial'));
  const lc   = builder.createState(sid('loadConfig'));
  const exec = builder.createState(sid('execute'));
  const term = builder.createTerminal(sid('terminal'));
  builder.createTransition(tid('initial-->loadConfig'), init.id, lc.id);
  builder.createTransition(tid('loadConfig-->execute:ok'), lc.id, exec.id, StateStatus.Ok);
  builder.createTransition(tid('execute-->terminal'), exec.id, term.id);
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
    sm.onStopped(sid('loadConfig'), StateStatus.Ok);
    expect(started).toContain('execute');
  });

  it('exits machine with Error when narrowed transition does not match', () => {
    const sm = build();
    sm.start();
    const smStopped: StateStatus[] = [];
    sm.onStateMachineStopped.add(e => smStopped.push(e.stateStatus));
    sm.onStopped(sid('loadConfig'), StateStatus.Error);
    expect(smStopped[0]).toBe(StateStatus.Error);
  });

  it('does not emit onStateStart for execute when narrowing fails', () => {
    const sm = build();
    sm.start();
    const started: string[] = [];
    sm.onStateStart.add(e => {
      const evt = Array.isArray(e) ? e[0]! : e;
      started.push(String(evt.toStateId));
    });
    sm.onStopped(sid('loadConfig'), StateStatus.Error);
    expect(started).not.toContain('execute');
  });
});
