import { SMStateType, SMStatus } from '../types';
import { InitialState } from './InitialState';
import { TerminalState } from './TerminalState';
import { UserDefinedState } from './UserDefinedState';
import { ChoiceState } from './ChoiceState';
import { ForkState } from './ForkState';

const id = 's1' as import('../types').SMStateId;

describe('InitialState', () => {
  it('has type Initial and stores payload', () => {
    const s = new InitialState(id, { x: 1 });
    expect(s.type).toBe(SMStateType.Initial);
    expect(s.stateStatus).toBe(SMStatus.None);
    expect(s.payload).toEqual({ x: 1 });
  });
  it('payload defaults to undefined', () => {
    expect(new InitialState(id).payload).toBeUndefined();
  });
});

describe('TerminalState', () => {
  it('has type Terminal', () => {
    expect(new TerminalState(id).type).toBe(SMStateType.Terminal);
  });
});

describe('UserDefinedState', () => {
  it('has type UserDefined and stores config', () => {
    const s = new UserDefinedState(id, { retries: 3 });
    expect(s.type).toBe(SMStateType.UserDefined);
    expect(s.config).toEqual({ retries: 3 });
  });
});

describe('ChoiceState', () => {
  it('has type Choice', () => {
    expect(new ChoiceState(id).type).toBe(SMStateType.Choice);
  });
});

describe('ForkState', () => {
  it('has type Fork and stores clonePayload fn', () => {
    const clone = (p: unknown) => p;
    const s = new ForkState(id, clone);
    expect(s.type).toBe(SMStateType.Fork);
    expect(s.clonePayload).toBe(clone);
  });
  it('clonePayload defaults to undefined', () => {
    expect(new ForkState(id).clonePayload).toBeUndefined();
  });
});
