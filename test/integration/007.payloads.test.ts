// src/__integration__/007.payloads.test.ts
import { BasicStateMachine } from '../../src/BasicStateMachine';
import { StateMachineBuilder } from '../../src/StateMachineBuilder';
import { StateStatus } from "@src/IState";
import type { StateMachineId, StateId, TransitionId, StateStartEvent, StateStoppedEvent, StateMachineStoppedEvent } from '../../src/types';

const smid = (s: string) => s as StateMachineId;
const sid  = (s: string) => s as StateId;
const tid  = (s: string) => s as TransitionId;

describe('spec 007 — payloads', () => {
  it('payload from onStopped is forwarded in onStateStopped and onStateStart', () => {
    const sm   = new BasicStateMachine(smid('payloads'));
    const builder = new StateMachineBuilder(sm);
    const init = builder.createInitial(sid('initial'));
    const s1   = builder.createState(sid('init'));
    const s2   = builder.createState(sid('execute'));
    const term = builder.createTerminal(sid('terminal'));
    builder.createTransition(tid('initial-->init'), init.id, s1.id);
    builder.createTransition(tid('init-->execute'), s1.id, s2.id);
    builder.createTransition(tid('execute-->terminal'), s2.id, term.id);

    sm.start();
    const stoppedEvts: StateStoppedEvent[] = [];
    const startEvts:   StateStartEvent[]   = [];
    const smStoppedEvts: StateMachineStoppedEvent[]    = [];

    sm.onStateStopped.add(e => stoppedEvts.push(e));
    sm.onStateStart.add(e => {
      const evt = Array.isArray(e) ? e[0]! : e;
      startEvts.push(evt);
    });
    sm.onStateMachineStopped.add(e => smStoppedEvts.push(e));

    sm.onStopped(sid('init'), StateStatus.Ok, undefined, [1, 2, 3]);
    expect(stoppedEvts[0]?.payload).toEqual([1, 2, 3]);
    expect(startEvts[0]?.payload).toEqual([1, 2, 3]);

    sm.onStopped(sid('execute'), StateStatus.Ok, undefined, ['invoices']);
    expect(smStoppedEvts[0]?.payload).toEqual(['invoices']);
  });
});
