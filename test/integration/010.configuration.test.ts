// src/__integration__/010.configuration.test.ts
import { BasicStateMachine } from '../../src/base/BasicStateMachine';
import { StateMachineBuilder } from '../../src/base/StateMachineBuilder';
import { StateStatus } from "@src/model/State";
import type { StateMachineId, StateId, TransitionId, StateStartEvent } from '../../src/model/types';

const smid = (s: string) => s as StateMachineId;
const sid  = (s: string) => s as StateId;
const tid  = (s: string) => s as TransitionId;

describe('spec 010 — configuration', () => {
  it('config is accessible on a state via getState().config', () => {
    const sm   = new BasicStateMachine(smid('basicTransition'));
    const builder = new StateMachineBuilder(sm);
    const init = builder.createInitial(sid('init'), { propertyX: [1, 2, 3] });
    const exec = builder.createState(sid('execute'), { configProperty: 'foo' });
    const term = builder.createTerminal(sid('terminal'));
    builder.createTransition(tid('t0'), init.id, exec.id);
    builder.createTransition(tid('t1'), exec.id, term.id);

    expect(sm.getState(sid('execute'))?.config).toEqual({ configProperty: 'foo' });
  });

  it('initial payload is forwarded as payload in the first onStateStart', () => {
    const sm   = new BasicStateMachine(smid('configPayload'));
    const builder = new StateMachineBuilder(sm);
    const init = builder.createInitial(sid('init'), { seed: 99 });
    const exec = builder.createState(sid('execute'));
    const term = builder.createTerminal(sid('terminal'));
    builder.createTransition(tid('t0'), init.id, exec.id);
    builder.createTransition(tid('t1'), exec.id, term.id);

    const firstStart: StateStartEvent[] = [];
    sm.onStateStart.add(e => {
      const evt = Array.isArray(e) ? e[0]! : e;
      firstStart.push(evt);
    });

    sm.start();
    expect(firstStart[0]?.payload).toEqual({ seed: 99 });
  });

  it('state config does not affect routing — machine runs normally', () => {
    const sm   = new BasicStateMachine(smid('configRouting'));
    const builder = new StateMachineBuilder(sm);
    const init = builder.createInitial(sid('init'));
    const exec = builder.createState(sid('execute'), { retries: 3, timeout: 5000 });
    const term = builder.createTerminal(sid('terminal'));
    builder.createTransition(tid('t0'), init.id, exec.id);
    builder.createTransition(tid('t1'), exec.id, term.id);

    const smStops: StateStatus[] = [];
    sm.onStateMachineStopped.add(e => smStops.push(e.stateStatus));
    sm.start();
    sm.onStopped(sid('execute'), StateStatus.Ok);
    expect(smStops[0]).toBe(StateStatus.Ok);
  });
});
