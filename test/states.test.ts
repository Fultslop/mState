import { StateType, StateStatus } from "@src/model/State";
import type { StateId, StateMachineId } from '@src/model/types';
import { InitialState } from '@src/base/InitialState';
import { TerminalState } from '@src/base/TerminalState';
import { UserDefinedState } from '@src/base/UserDefinedState';
import { ChoiceState } from '@src/base/ChoiceState';
import { ForkState } from '@src/base/ForkState';
import { Region } from '@src/base/Region';
import { BasicStateMachine } from '@src/base/BasicStateMachine';
import { ParallelState } from '@src/base/ParallelState';

const smid = (s: string) => s as StateMachineId;
const sid  = (s: string) => s as StateId;
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

describe('Region', () => {
  it('creates an implicit terminal state registered in the SM', () => {
    const sm = new BasicStateMachine(smid('test'));
    const region = new Region('r1', (s) => sm.addState(s), sid('parallel1'));
    expect(sm.getState(region.terminal.id)).toBeDefined();
    expect(region.terminal.type).toBe(StateType.Terminal);
  });

  it('terminal parentId is the parallel state id', () => {
    const sm = new BasicStateMachine(smid('test'));
    const region = new Region('r1', (s) => sm.addState(s), sid('parallel1'));
    expect(region.terminal.parentId).toBe(sid('parallel1'));
  });

  it('addState sets parentId on the state', () => {
    const sm = new BasicStateMachine(smid('test'));
    const region = new Region('r1', (s) => sm.addState(s), sid('parallel1'));
    const fakeState = { id: sid('s1'), parentId: undefined as StateId | undefined } as any;
    region.addState(fakeState);
    expect(fakeState.parentId).toBe(sid('parallel1'));
    expect(region.stateIds.has(sid('s1'))).toBe(true);
  });

  it('starts with status None', () => {
    const sm = new BasicStateMachine(smid('test'));
    const region = new Region('r1', (s) => sm.addState(s), sid('parallel1'));
    expect(region.status).toBe(StateStatus.None);
  });
});

describe('ParallelState', () => {
  it('has type Parallel', () => {
    const sm = new BasicStateMachine(smid('test'));
    const ps = new ParallelState(sid('p1'), (s) => sm.addState(s));
    expect(ps.type).toBe(StateType.Parallel);
  });

  it('createRegion returns a Region with terminal in SM', () => {
    const sm = new BasicStateMachine(smid('test'));
    const ps = new ParallelState(sid('p1'), (s) => sm.addState(s));
    const r = ps.createRegion('r1');
    expect(r.terminal).toBeDefined();
    expect(sm.getState(r.terminal.id)).toBeDefined();
  });

  it('getRegions returns all created regions', () => {
    const sm = new BasicStateMachine(smid('test'));
    const ps = new ParallelState(sid('p1'), (s) => sm.addState(s));
    ps.createRegion('r1');
    ps.createRegion('r2');
    expect(ps.getRegions()).toHaveLength(2);
  });

  it('payloadClone is stored', () => {
    const sm = new BasicStateMachine(smid('test'));
    const clone = (p: unknown) => ({ ...p as object });
    const ps = new ParallelState(sid('p1'), (s) => sm.addState(s), clone);
    expect(ps.payloadClone).toBe(clone);
  });
});
