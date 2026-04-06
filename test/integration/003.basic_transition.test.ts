// src/__integration__/003.basic_transition.test.ts
import { BasicStateMachine } from '../../src/base/BasicStateMachine';
import { StateMachineBuilder } from '../../src/base/StateMachineBuilder';
import { StateStatus } from "@src/model/State";
import type { StateMachineId, StateId, TransitionId } from '../../src/model/types';

const smid = (s: string) => s as StateMachineId;
const sid  = (s: string) => s as StateId;
const tid  = (s: string) => s as TransitionId;

function build() {
  const sm   = new BasicStateMachine(smid('basicTransition'));
  const builder = new StateMachineBuilder(sm);
  const init = builder.createInitial(sid('initial'));
  const s1   = builder.createState(sid('init'));
  const s2   = builder.createState(sid('execute'));
  const term = builder.createTerminal(sid('terminal'));
  builder.createTransition(tid('initial-->init'), init.id, s1.id);
  builder.createTransition(tid('init-->execute'), s1.id, s2.id);
  builder.createTransition(tid('execute-->terminal'), s2.id, term.id);
  return sm;
}

describe('spec 003 — basic transition', () => {
  it('full event sequence with Ok', () => {
    const sm = build();
    const events: string[] = [];
    sm.onStateMachineStarted.add(()    => events.push('SMStarted'));
    sm.onStateStart.add(e    => {
      const evt = Array.isArray(e) ? e[0]! : e;
      events.push(`Start:${evt.toStateId}`);
    });
    sm.onStateStopped.add(e  => events.push(`Stopped:${e.stateId}`));
    sm.onStateMachineStopped.add(e     => events.push(`SMStopped:${e.stateStatus}`));

    sm.start();
    sm.onStopped(sid('init'), StateStatus.Ok);
    sm.onStopped(sid('execute'), StateStatus.Ok);

    expect(events).toEqual([
      'SMStarted', 'Start:init',
      'Stopped:init', 'Start:execute',
      'Stopped:execute', 'SMStopped:ok',
    ]);
  });

  it('unqualified transition fires even when state exits with Error', () => {
    const sm = build();
    sm.start();
    const started: string[] = [];
    sm.onStateStart.add(e => {
      const evt = Array.isArray(e) ? e[0]! : e;
      started.push(String(evt.toStateId));
    });
    sm.onStopped(sid('init'), StateStatus.Error);
    expect(started).toContain('execute');
  });
});
