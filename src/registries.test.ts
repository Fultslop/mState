import { SMValidationException } from './exceptions';
import { StateRegistry } from './StateRegistry';
import { TransitionRegistry } from './TransitionRegistry';
import { UserDefinedState } from './states/UserDefinedState';
import { SMTransition } from './SMTransition';
import type { SMStateId, SMTransitionId } from './types';

const sid = (s: string) => s as SMStateId;
const tid = (s: string) => s as SMTransitionId;

describe('StateRegistry', () => {
  let reg: StateRegistry;
  beforeEach(() => { reg = new StateRegistry(); });

  it('starts empty', () => {
    expect(reg.count()).toBe(0);
    expect(reg.ids()).toHaveLength(0);
  });

  it('adds and retrieves a state', () => {
    const s = new UserDefinedState(sid('s1'));
    reg.add(s);
    expect(reg.get(sid('s1'))).toBe(s);
    expect(reg.count()).toBe(1);
  });

  it('throws on duplicate id', () => {
    reg.add(new UserDefinedState(sid('s1')));
    expect(() => reg.add(new UserDefinedState(sid('s1'))))
      .toThrow(SMValidationException);
  });

  it('removes a state', () => {
    reg.add(new UserDefinedState(sid('s1')));
    reg.remove(sid('s1'));
    expect(reg.get(sid('s1'))).toBeUndefined();
    expect(reg.count()).toBe(0);
  });

  it('returns undefined for missing id', () => {
    expect(reg.get(sid('nope'))).toBeUndefined();
  });

  it('returns all states', () => {
    reg.add(new UserDefinedState(sid('a')));
    reg.add(new UserDefinedState(sid('b')));
    expect(reg.all()).toHaveLength(2);
  });

  it('ids() returns current keys', () => {
    reg.add(new UserDefinedState(sid('x')));
    expect(reg.ids()).toContain(sid('x'));
  });
});

describe('TransitionRegistry', () => {
  let reg: TransitionRegistry;
  beforeEach(() => { reg = new TransitionRegistry(); });

  it('starts empty', () => {
    expect(reg.count()).toBe(0);
  });

  it('adds and retrieves a transition', () => {
    const t = new SMTransition(tid('t1'), sid('a'), sid('b'));
    reg.add(t);
    expect(reg.get(tid('t1'))).toBe(t);
    expect(reg.count()).toBe(1);
  });

  it('throws on duplicate id', () => {
    reg.add(new SMTransition(tid('t1'), sid('a'), sid('b')));
    expect(() => reg.add(new SMTransition(tid('t1'), sid('a'), sid('b'))))
      .toThrow(SMValidationException);
  });

  it('removes a transition', () => {
    reg.add(new SMTransition(tid('t1'), sid('a'), sid('b')));
    reg.remove(tid('t1'));
    expect(reg.get(tid('t1'))).toBeUndefined();
  });
});
