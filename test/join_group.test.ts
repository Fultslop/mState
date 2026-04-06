import { StateType } from '@src/model/State';
import type { StateId, TransitionId } from '@src/model/types';
import type { StateStartEvent } from '@src/model/types';
import { BasicJoinState } from '@src/states/BasicJoinState';
import { BasicGroupState } from '@src/states/BasicGroupState';
import { UserDefinedState } from '@src/states/UserDefinedState';

const sid = (s: string) => s as StateId;
const tid = (s: string) => s as TransitionId;

describe('JoinState', () => {
  it('has type Join', () => {
    expect(new BasicJoinState(sid('j')).type).toBe(StateType.Join);
  });

  it('is not complete with no incoming dependencies met', () => {
    const j = new BasicJoinState(sid('j'));
    j.incoming.add(tid('t1'));
    j.incoming.add(tid('t2'));
    expect(j.isComplete).toBe(false);
  });

  it('is complete when all incoming transitions have reported', () => {
    const j = new BasicJoinState(sid('j'));
    j.incoming.add(tid('t1'));
    j.incoming.add(tid('t2'));
    const evt1: StateStartEvent = {
      fromStateId: sid('a'), transitionId: tid('t1'),
      toStateId: sid('j'), payload: undefined,
    };
    const evt2: StateStartEvent = {
      fromStateId: sid('b'), transitionId: tid('t2'),
      toStateId: sid('j'), payload: undefined,
    };
    j.onDependencyComplete(evt1);
    expect(j.isComplete).toBe(false);
    j.onDependencyComplete(evt2);
    expect(j.isComplete).toBe(true);
  });

  it('receivedPayloads returns the collected events', () => {
    const j = new BasicJoinState(sid('j'));
    j.incoming.add(tid('t1'));
    const evt: StateStartEvent = {
      fromStateId: sid('a'), transitionId: tid('t1'),
      toStateId: sid('j'), payload: 42,
    };
    j.onDependencyComplete(evt);
    expect(j.receivedPayloads).toHaveLength(1);
    expect(j.receivedPayloads[0]).toBe(evt);
  });

  it('reset clears received payloads', () => {
    const j = new BasicJoinState(sid('j'));
    j.incoming.add(tid('t1'));
    const evt: StateStartEvent = {
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
    expect(new BasicGroupState(sid('g')).type).toBe(StateType.Group);
  });

  it('tracks member states', () => {
    const g = new BasicGroupState(sid('g'));
    const s = new UserDefinedState(sid('s1'));
    g.addState(s);
    expect(g.hasState(sid('s1'))).toBe(true);
    expect(g.hasState(sid('s2'))).toBe(false);
    expect(g.stateIds.has(sid('s1'))).toBe(true);
  });

  it('stores config', () => {
    const g = new BasicGroupState(sid('g'), { timeout: 5000 });
    expect(g.config).toEqual({ timeout: 5000 });
  });
});
