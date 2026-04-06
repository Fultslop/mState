// src/__integration__/010.configuration.test.ts
import { StateMachine } from '../../src/StateMachine';
import { SMStatus } from '../../src/types';
import type { SMStateMachineId, SMStateId, SMTransitionId, SMStateStartEvent } from '../../src/types';

const smid = (s: string) => s as SMStateMachineId;
const sid  = (s: string) => s as SMStateId;
const tid  = (s: string) => s as SMTransitionId;

describe('spec 010 — configuration', () => {
  it('config is accessible on a state via getState().config', () => {
    const sm   = new StateMachine(smid('basicTransition'));
    const init = sm.createInitial(sid('init'), { propertyX: [1, 2, 3] });
    const exec = sm.createState(sid('execute'), { configProperty: 'foo' });
    const term = sm.createTerminal(sid('terminal'));
    sm.createTransition(tid('t0'), init.id, exec.id);
    sm.createTransition(tid('t1'), exec.id, term.id);

    expect(sm.getState(sid('execute'))?.config).toEqual({ configProperty: 'foo' });
  });

  it('initial payload is forwarded as payload in the first onStateStart', () => {
    const sm   = new StateMachine(smid('configPayload'));
    const init = sm.createInitial(sid('init'), { seed: 99 });
    const exec = sm.createState(sid('execute'));
    const term = sm.createTerminal(sid('terminal'));
    sm.createTransition(tid('t0'), init.id, exec.id);
    sm.createTransition(tid('t1'), exec.id, term.id);

    const firstStart: SMStateStartEvent[] = [];
    sm.onStateStart.add(e => {
      const evt = Array.isArray(e) ? e[0]! : e;
      firstStart.push(evt);
    });

    sm.start();
    expect(firstStart[0]?.payload).toEqual({ seed: 99 });
  });

  it('state config does not affect routing — machine runs normally', () => {
    const sm   = new StateMachine(smid('configRouting'));
    const init = sm.createInitial(sid('init'));
    const exec = sm.createState(sid('execute'), { retries: 3, timeout: 5000 });
    const term = sm.createTerminal(sid('terminal'));
    sm.createTransition(tid('t0'), init.id, exec.id);
    sm.createTransition(tid('t1'), exec.id, term.id);

    const smStops: SMStatus[] = [];
    sm.onSMStopped.add(e => smStops.push(e.stateStatus));
    sm.start();
    sm.onStopped(sid('execute'), SMStatus.Ok);
    expect(smStops[0]).toBe(SMStatus.Ok);
  });
});
