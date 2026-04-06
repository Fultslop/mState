// src/__integration__/007.payloads.test.ts
import { StateMachine } from '../StateMachine';
import { SMStatus } from '../types';
import type { SMStateMachineId, SMStateId, SMTransitionId, SMStateStartEvent, SMStateStoppedEvent, SMStoppedEvent } from '../types';

const smid = (s: string) => s as SMStateMachineId;
const sid  = (s: string) => s as SMStateId;
const tid  = (s: string) => s as SMTransitionId;

describe('spec 007 — payloads', () => {
  it('payload from onStopped is forwarded in onStateStopped and onStateStart', () => {
    const sm   = new StateMachine(smid('payloads'));
    const init = sm.createInitial(sid('initial'));
    const s1   = sm.createState(sid('init'));
    const s2   = sm.createState(sid('execute'));
    const term = sm.createTerminal(sid('terminal'));
    sm.createTransition(tid('t0'), init.id, s1.id);
    sm.createTransition(tid('t1'), s1.id, s2.id);
    sm.createTransition(tid('t2'), s2.id, term.id);

    sm.start();
    const stoppedEvts: SMStateStoppedEvent[] = [];
    const startEvts:   SMStateStartEvent[]   = [];
    const smStoppedEvts: SMStoppedEvent[]    = [];

    sm.onStateStopped.add(e => stoppedEvts.push(e));
    sm.onStateStart.add(e => {
      const evt = Array.isArray(e) ? e[0]! : e;
      startEvts.push(evt);
    });
    sm.onSMStopped.add(e => smStoppedEvts.push(e));

    sm.onStopped(sid('init'), SMStatus.Ok, undefined, [1, 2, 3]);
    expect(stoppedEvts[0]?.payload).toEqual([1, 2, 3]);
    expect(startEvts[0]?.payload).toEqual([1, 2, 3]);

    sm.onStopped(sid('execute'), SMStatus.Ok, undefined, ['invoices']);
    expect(smStoppedEvts[0]?.payload).toEqual(['invoices']);
  });
});
