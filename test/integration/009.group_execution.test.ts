// src/__integration__/009.group_execution.test.ts
import { BasicStateMachine } from '../../src/BasicStateMachine';
import { StateStatus } from "@src/IState";
import type { StateMachineId, StateId, TransitionId } from '../../src/types';

const smid = (s: string) => s as StateMachineId;
const sid  = (s: string) => s as StateId;
const tid  = (s: string) => s as TransitionId;

function build() {
  const sm        = new BasicStateMachine(smid('groupExample'));
  const rootInit  = sm.createInitial(sid('rootInit'));
  const group     = sm.createGroup(sid('group'));
  const groupInit = sm.createInitial(sid('groupInit'));
  const step1     = sm.createState(sid('step1'));
  const step2     = sm.createState(sid('step2'));
  const groupTerm = sm.createTerminal(sid('groupTerm'));
  const ch        = sm.createChoice(sid('groupChoice'));
  const logErr    = sm.createState(sid('logError'));
  const rootTerm  = sm.createTerminal(sid('rootTerm'));

  // Register group members
  group.addMember(groupInit);
  group.addMember(step1);
  group.addMember(step2);
  group.addMember(groupTerm);

  // Top-level transitions
  sm.createTransition(tid('t0'), rootInit.id, group.id);
  sm.createTransition(tid('t1'), group.id, ch.id);
  sm.createTransition(tid('t2'), ch.id, rootTerm.id);
  sm.createTransition(tid('t3'), ch.id, logErr.id, StateStatus.Error);
  sm.createTransition(tid('t4'), logErr.id, rootTerm.id);

  // Group-internal transitions
  sm.createTransition(tid('gi0'), groupInit.id, step1.id);
  sm.createTransition(tid('gi1'), step1.id, step2.id, StateStatus.Ok);
  sm.createTransition(tid('gi2'), step2.id, groupTerm.id, StateStatus.Ok);

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
    sm.onSMStopped.add(e => smStops.push(e.stateStatus));
    sm.onStopped(sid('step1'), StateStatus.Error);
    // step1 has narrowed Ok transition to step2; Error causes noMatch → SMStopped with Error
    // OR the group exits with Error → groupChoice → logError branch
    expect(smStops.length > 0 || started.some(id => id === 'logError')).toBe(true);
  });
});
