// src/__integration__/002.basic_state.test.ts
import { BasicStateMachine } from '../../src/BasicStateMachine';
import { StateStatus } from "@src/IState";
import type { StateMachineId, StateId, TransitionId } from '../../src/types';

const smid = (s: string) => s as StateMachineId;
const sid  = (s: string) => s as StateId;
const tid  = (s: string) => s as TransitionId;

describe('spec 002 — basic single state', () => {
  function buildSM() {
    const sm   = new BasicStateMachine(smid('basicExample'));
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

    sm.onStopped(sid('initialize'), StateStatus.Ok);
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
    expect(sm.getState(sid('initialize'))?.stateStatus).toBe(StateStatus.Active);
  });

  it('machine exits with Ok status matching the state completion', () => {
    const sm = buildSM();
    const stopped: StateStatus[] = [];
    sm.onSMStopped.add(e => stopped.push(e.stateStatus));
    sm.start();
    sm.onStopped(sid('initialize'), StateStatus.Ok);
    expect(stopped[0]).toBe(StateStatus.Ok);
  });
});
