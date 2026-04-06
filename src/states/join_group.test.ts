import { SMStateType } from '../types';
import type { SMStateId, SMTransitionId } from '../types';
import type { SMStateStartEvent } from '../types';
import { JoinState } from './JoinState';
import { GroupState } from './GroupState';
import { UserDefinedState } from './UserDefinedState';

const sid = (s: string) => s as SMStateId;
const tid = (s: string) => s as SMTransitionId;

describe('JoinState', () => {
  it('has type Join', () => {
    expect(new JoinState(sid('j')).type).toBe(SMStateType.Join);
  });

  it('is not complete with no incoming dependencies met', () => {
    const j = new JoinState(sid('j'));
    j.incoming.add(tid('t1'));
    j.incoming.add(tid('t2'));
    expect(j.isComplete).toBe(false);
  });

  it('is complete when all incoming transitions have reported', () => {
    const j = new JoinState(sid('j'));
    j.incoming.add(tid('t1'));
    j.incoming.add(tid('t2'));
    const evt1: SMStateStartEvent = {
      fromStateId: sid('a'), transitionId: tid('t1'),
      toStateId: sid('j'), payload: undefined,
    };
    const evt2: SMStateStartEvent = {
      fromStateId: sid('b'), transitionId: tid('t2'),
      toStateId: sid('j'), payload: undefined,
    };
    j.onDependencyComplete(evt1);
    expect(j.isComplete).toBe(false);
    j.onDependencyComplete(evt2);
    expect(j.isComplete).toBe(true);
  });

  it('receivedPayloads returns the collected events', () => {
    const j = new JoinState(sid('j'));
    j.incoming.add(tid('t1'));
    const evt: SMStateStartEvent = {
      fromStateId: sid('a'), transitionId: tid('t1'),
      toStateId: sid('j'), payload: 42,
    };
    j.onDependencyComplete(evt);
    expect(j.receivedPayloads).toHaveLength(1);
    expect(j.receivedPayloads[0]).toBe(evt);
  });

  it('reset clears received payloads', () => {
    const j = new JoinState(sid('j'));
    j.incoming.add(tid('t1'));
    const evt: SMStateStartEvent = {
      fromStateId: sid('a'), transitionId: tid('t1'),
      toStateId: sid('j'), payload: undefined,
    };
    j.onDependencyComplete(evt);
    j.reset();
    expect(j.isComplete).toBe(false);
    expect(j.receivedPayloads).toHaveLength(0);
  });
});

describe('GroupState', () => {
  it('has type Group', () => {
    expect(new GroupState(sid('g')).type).toBe(SMStateType.Group);
  });

  it('tracks member states', () => {
    const g = new GroupState(sid('g'));
    const s = new UserDefinedState(sid('s1'));
    g.addMember(s);
    expect(g.hasMember(sid('s1'))).toBe(true);
    expect(g.hasMember(sid('s2'))).toBe(false);
    expect(g.memberIds.has(sid('s1'))).toBe(true);
  });

  it('stores config', () => {
    const g = new GroupState(sid('g'), { timeout: 5000 });
    expect(g.config).toEqual({ timeout: 5000 });
  });
});
