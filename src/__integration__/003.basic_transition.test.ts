// src/__integration__/003.basic_transition.test.ts
import { StateMachine } from '../StateMachine';
import { SMStatus } from '../types';
import type { SMStateMachineId, SMStateId, SMTransitionId } from '../types';

const smid = (s: string) => s as SMStateMachineId;
const sid  = (s: string) => s as SMStateId;
const tid  = (s: string) => s as SMTransitionId;

function build() {
  const sm   = new StateMachine(smid('basicTransition'));
  const init = sm.createInitial(sid('initial'));
  const s1   = sm.createState(sid('init'));
  const s2   = sm.createState(sid('execute'));
  const term = sm.createTerminal(sid('terminal'));
  sm.createTransition(tid('t0'), init.id, s1.id);
  sm.createTransition(tid('t1'), s1.id, s2.id);
  sm.createTransition(tid('t2'), s2.id, term.id);
  return sm;
}

describe('spec 003 — basic transition', () => {
  it('full event sequence with Ok', () => {
    const sm = build();
    const events: string[] = [];
    sm.onSMStarted.add(()    => events.push('SMStarted'));
    sm.onStateStart.add(e    => {
      const evt = Array.isArray(e) ? e[0]! : e;
      events.push(`Start:${evt.toStateId}`);
    });
    sm.onStateStopped.add(e  => events.push(`Stopped:${e.stateId}`));
    sm.onSMStopped.add(e     => events.push(`SMStopped:${e.stateStatus}`));

    sm.start();
    sm.onStopped(sid('init'), SMStatus.Ok);
    sm.onStopped(sid('execute'), SMStatus.Ok);

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
    sm.onStopped(sid('init'), SMStatus.Error);
    expect(started).toContain('execute');
  });
});
