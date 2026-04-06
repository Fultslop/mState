import { SMStateType, SMStatus } from './types';
import type { SMStateMachineId, SMStateId, SMTransitionId } from './types';
import { StateMachine } from './StateMachine';
import { SMValidationException } from './exceptions';

const smid = (s: string) => s as SMStateMachineId;
const sid  = (s: string) => s as SMStateId;
const tid  = (s: string) => s as SMTransitionId;

describe('StateMachine construction', () => {
  it('stores its id', () => {
    const sm = new StateMachine(smid('test'));
    expect(sm.id).toBe(smid('test'));
  });

  it('starts with zero states and transitions', () => {
    const sm = new StateMachine(smid('test'));
    expect(sm.getStateCount()).toBe(0);
    expect(sm.getTransitionCount()).toBe(0);
  });

  it('createInitial adds an Initial state', () => {
    const sm = new StateMachine(smid('test'));
    const s = sm.createInitial(sid('init'));
    expect(s.type).toBe(SMStateType.Initial);
    expect(sm.getState(sid('init'))).toBe(s);
    expect(sm.getStateCount()).toBe(1);
  });

  it('createState adds a UserDefined state', () => {
    const sm = new StateMachine(smid('test'));
    const s = sm.createState(sid('s1'), { x: 1 });
    expect(s.type).toBe(SMStateType.UserDefined);
    expect(s.config).toEqual({ x: 1 });
  });

  it('createTerminal adds a Terminal state', () => {
    const sm = new StateMachine(smid('test'));
    const s = sm.createTerminal(sid('term'));
    expect(s.type).toBe(SMStateType.Terminal);
  });

  it('createChoice adds a Choice state', () => {
    const sm = new StateMachine(smid('test'));
    const s = sm.createChoice(sid('ch'));
    expect(s.type).toBe(SMStateType.Choice);
  });

  it('createFork adds a Fork state', () => {
    const sm = new StateMachine(smid('test'));
    const s = sm.createFork(sid('f'));
    expect(s.type).toBe(SMStateType.Fork);
  });

  it('createJoin adds a Join state', () => {
    const sm = new StateMachine(smid('test'));
    const s = sm.createJoin(sid('j'));
    expect(s.type).toBe(SMStateType.Join);
  });

  it('createGroup adds a Group state', () => {
    const sm = new StateMachine(smid('test'));
    const g = sm.createGroup(sid('g'));
    expect(g.type).toBe(SMStateType.Group);
  });

  it('createTransition wires incoming/outgoing sets', () => {
    const sm = new StateMachine(smid('test'));
    const a = sm.createState(sid('a'));
    const b = sm.createState(sid('b'));
    sm.createTransition(tid('t1'), sid('a'), sid('b'));
    expect(a.outgoing.has(tid('t1'))).toBe(true);
    expect(b.incoming.has(tid('t1'))).toBe(true);
    expect(sm.getTransitionCount()).toBe(1);
  });

  it('validate() throws SMValidationException for invalid graph', () => {
    const sm = new StateMachine(smid('test'));
    sm.createState(sid('s1')); // no initial, invalid
    expect(() => sm.validate()).toThrow(SMValidationException);
  });

  it('getStateIds and getTransitionIds return current ids', () => {
    const sm = new StateMachine(smid('test'));
    sm.createState(sid('a'));
    expect(sm.getStateIds()).toContain(sid('a'));
    sm.removeState(sid('a'));
    expect(sm.getStateIds()).not.toContain(sid('a'));
  });
});
