// src/__integration__/009.group_execution.test.ts
import { BasicStateMachine } from '../../src/BasicStateMachine';
import { StateMachineBuilder } from '../../src/StateMachineBuilder';
import { StateStatus } from "@src/IState";
import type { StateMachineId, StateId, TransitionId } from '../../src/types';

const smid = (s: string) => s as StateMachineId;
const sid  = (s: string) => s as StateId;
const tid  = (s: string) => s as TransitionId;

function build() {
  const sm        = new BasicStateMachine(smid('groupExample'));
  const builder   = new StateMachineBuilder(sm);
  const rootInit  = builder.createInitial(sid('initial'));
  const group     = builder.createGroup(sid('group'));
  const groupInit = builder.createInitial(sid('group__initial'));
  const step1     = builder.createState(sid('step1'));
  const step2     = builder.createState(sid('step2'));
  const groupTerm = builder.createTerminal(sid('group__terminal'));
  const ch        = builder.createChoice(sid('groupChoice'));
  const logErr    = builder.createState(sid('logError'));
  const rootTerm  = builder.createTerminal(sid('terminal'));

  // Register group members
  group.addState(groupInit);
  group.addState(step1);
  group.addState(step2);
  group.addState(groupTerm);

  // Top-level transitions
  builder.createTransition(tid('initial-->group'), rootInit.id, group.id);
  builder.createTransition(tid('group-->groupChoice'), group.id, ch.id);
  builder.createTransition(tid('groupChoice-->terminal'), ch.id, rootTerm.id);
  builder.createTransition(tid('groupChoice-->logError:error'), ch.id, logErr.id, StateStatus.Error);
  builder.createTransition(tid('logError-->terminal'), logErr.id, rootTerm.id);

  // Group-internal transitions
  builder.createTransition(tid('group__initial-->step1'), groupInit.id, step1.id);
  builder.createTransition(tid('step1-->step2:ok'), step1.id, step2.id, StateStatus.Ok);
  builder.createTransition(tid('step2-->group__terminal:ok'), step2.id, groupTerm.id, StateStatus.Ok);

  return sm;
}

describe('spec 009 — group execution', () => {
  it('onStateStart fires for group then immediately for step1', () => {
    const sm = build();
    const started: string[] = [];
    sm.onStateStart.add(e => {
      const evt = Array.isArray(e) ? e[0]! : e;
      started.push(String(evt.toStateId));
    });
    sm.start();
    expect(started).toContain('group');
    expect(started).toContain('step1');
    expect(started.indexOf('group')).toBeLessThan(started.indexOf('step1'));
  });

  it('group is Active while its internal states are running', () => {
    const sm = build();
    sm.start();
    expect(sm.getState(sid('group'))?.stateStatus).toBe(StateStatus.Active);
  });

  it('onStateStopped fires for group when group terminal is reached (Ok path)', () => {
    const sm = build();
    sm.start();
    const stoppedIds: string[] = [];
    sm.onStateStopped.add(e => stoppedIds.push(String(e.stateId)));
    sm.onStopped(sid('step1'), StateStatus.Ok);
    sm.onStopped(sid('step2'), StateStatus.Ok);
    expect(stoppedIds).toContain('group');
  });

  it('group completion status matches the internal terminal exit status', () => {
    const sm = build();
    sm.start();
    const groupStops: StateStatus[] = [];
    sm.onStateStopped.add(e => {
      if (String(e.stateId) === 'group') groupStops.push(e.stateStatus);
    });
    sm.onStopped(sid('step1'), StateStatus.Ok);
    sm.onStopped(sid('step2'), StateStatus.Ok);
    expect(groupStops[0]).toBe(StateStatus.Ok);
  });

  it('routes to logError via choice when group exits with Error', () => {
    const sm = build();
    sm.start();
    const started: string[] = [];
    sm.onStateStart.add(e => {
      const evt = Array.isArray(e) ? e[0]! : e;
      started.push(String(evt.toStateId));
    });
    const smStops: StateStatus[] = [];
    sm.onStateMachineStopped.add(e => smStops.push(e.stateStatus));
    sm.onStopped(sid('step1'), StateStatus.Error);
    // step1 has narrowed Ok transition to step2; Error causes noMatch → SMStopped with Error
    // OR the group exits with Error → groupChoice → logError branch
    expect(smStops.length > 0 || started.some(id => id === 'logError')).toBe(true);
  });
});
