import { StateType, StateStatus } from "@src/model/State";
import type { StateId } from '@src/model/types';
import { InitialState } from '@src/states/InitialState';
import { TerminalState } from '@src/states/TerminalState';
import { UserDefinedState } from '@src/states/UserDefinedState';
import { ChoiceState } from '@src/states/ChoiceState';
import { ForkState } from '@src/states/ForkState';

const id = 's1' as StateId;

describe('InitialState', () => {
  it('has type Initial and stores payload', () => {
    const s = new InitialState(id, { x: 1 });
    expect(s.type).toBe(StateType.Initial);
    expect(s.stateStatus).toBe(StateStatus.None);
    expect(s.initialPayload).toEqual({ x: 1 });
  });
  it('payload defaults to undefined', () => {
    expect(new InitialState(id).initialPayload).toBeUndefined();
  });
});

describe('TerminalState', () => {
  it('has type Terminal', () => {
    expect(new TerminalState(id).type).toBe(StateType.Terminal);
  });
});

describe('UserDefinedState', () => {
  it('has type UserDefined and stores config', () => {
    const s = new UserDefinedState(id, { retries: 3 });
    expect(s.type).toBe(StateType.UserDefined);
    expect(s.config).toEqual({ retries: 3 });
  });
});

describe('ChoiceState', () => {
  it('has type Choice', () => {
    expect(new ChoiceState(id).type).toBe(StateType.Choice);
  });
});

describe('ForkState', () => {
  it('has type Fork and stores clonePayload fn', () => {
    const clone = (p: unknown) => p;
    const s = new ForkState(id, clone);
    expect(s.type).toBe(StateType.Fork);
    expect(s.clonePayload).toBe(clone);
  });
  it('clonePayload defaults to undefined', () => {
    expect(new ForkState(id).clonePayload).toBeUndefined();
  });
});
