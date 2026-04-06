// src/__integration__/002.basic_state.test.ts
import { StateMachine } from '../StateMachine';
import { SMStatus } from '../types';
import type { SMStateMachineId, SMStateId, SMTransitionId } from '../types';

const smid = (s: string) => s as SMStateMachineId;
const sid  = (s: string) => s as SMStateId;
const tid  = (s: string) => s as SMTransitionId;

describe('spec 002 — basic single state', () => {
  function buildSM() {
    const sm   = new StateMachine(smid('basicExample'));
    const init = sm.createInitial(sid('initial'));
    const s1   = sm.createState(sid('initialize'));
    const term = sm.createTerminal(sid('terminal'));
    sm.createTransition(tid('t0'), init.id, s1.id);
    sm.createTransition(tid('t1'), s1.id, term.id);
    return sm;
  }

  it('emits events in correct sequence', () => {
    const sm = buildSM();
    const events: string[] = [];

    sm.onSMStarted.add(e    => events.push(`onSMStarted:${e.statemachineId}`));
    sm.onStateStart.add(e   => {
      const evt = Array.isArray(e) ? e[0]! : e;
      events.push(`onStateStart:${evt.fromStateId}->${evt.toStateId}`);
    });
    sm.onStateStopped.add(e => events.push(`onStateStopped:${e.stateId}:${e.stateStatus}`));
    sm.onSMStopped.add(e    => events.push(`onSMStopped:${e.stateStatus}`));

    sm.start();
    expect(events).toEqual([
      'onSMStarted:basicExample',
      'onStateStart:initial->initialize',
    ]);

    sm.onStopped(sid('initialize'), SMStatus.Ok);
    expect(events).toEqual([
      'onSMStarted:basicExample',
      'onStateStart:initial->initialize',
      'onStateStopped:initialize:ok',
      'onSMStopped:ok',
    ]);
  });

  it('validate() passes on a well-formed machine', () => {
    expect(() => buildSM().validate()).not.toThrow();
  });

  it('initialize state is Active after start()', () => {
    const sm = buildSM();
    sm.start();
    expect(sm.getState(sid('initialize'))?.stateStatus).toBe(SMStatus.Active);
  });

  it('machine exits with Ok status matching the state completion', () => {
    const sm = buildSM();
    const stopped: SMStatus[] = [];
    sm.onSMStopped.add(e => stopped.push(e.stateStatus));
    sm.start();
    sm.onStopped(sid('initialize'), SMStatus.Ok);
    expect(stopped[0]).toBe(SMStatus.Ok);
  });
});
