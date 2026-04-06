// src/__integration__/001.entities.test.ts
// Verifies all entity types are constructable and branded IDs are distinct types.
import { BasicStateMachine } from '../../src/base/BasicStateMachine';
import { StateStatus, StateType } from "@src/model/State";
import type { StateMachineId, StateId, TransitionId } from '../../src/model/types';
import { SMValidationException, SMRuntimeException } from '../../src/base/exceptions';
import { StateMachineBuilder } from '@src/base/StateMachineBuilder';

const smid = (s: string) => s as StateMachineId;
const sid  = (s: string) => s as StateId;
const tid  = (s: string) => s as TransitionId;

describe('spec 001 — entities', () => {
  it('creates all state types without error', () => {
    const sm = new BasicStateMachine(smid('entities'));
    const builder = new StateMachineBuilder(sm);
    
    expect(() => {
      builder.createInitial(sid('init'));
      builder.createState(sid('s1'));
      builder.createTerminal(sid('term'));
      builder.createChoice(sid('ch'));
      builder.createFork(sid('fork'));
      builder.createJoin(sid('join'));
      builder.createGroup(sid('group'));
    }).not.toThrow();
    expect(sm.getStateCount()).toBe(7);
  });

  it('each state type has the correct SMStateType', () => {
    const sm = new BasicStateMachine(smid('types'));
    const builder = new StateMachineBuilder(sm);
    expect(builder.createInitial(sid('i')).type).toBe(StateType.Initial);
    expect(builder.createState(sid('s')).type).toBe(StateType.UserDefined);
    expect(builder.createTerminal(sid('t')).type).toBe(StateType.Terminal);
    expect(builder.createChoice(sid('c')).type).toBe(StateType.Choice);
    expect(builder.createFork(sid('f')).type).toBe(StateType.Fork);
    expect(builder.createJoin(sid('j')).type).toBe(StateType.Join);
    expect(builder.createGroup(sid('g')).type).toBe(StateType.Group);
  });

  it('states begin with SMStatus.None', () => {
    const sm = new BasicStateMachine(smid('status'));
    const builder = new StateMachineBuilder(sm);
    const s = builder.createState(sid('s1'));
    expect(s.stateStatus).toBe(StateStatus.None);
  });

  it('createTransition wires incoming/outgoing and returns the transition', () => {
    const sm = new BasicStateMachine(smid('trans'));
    const builder = new StateMachineBuilder(sm);
    const a = builder.createState(sid('a'));
    const b = builder.createState(sid('b'));
    const t = builder.createTransition(tid('t1'), sid('a'), sid('b'), StateStatus.Ok, 'code');
    expect(t.id).toBe(tid('t1'));
    expect(t.fromStateId).toBe(sid('a'));
    expect(t.toStateId).toBe(sid('b'));
    expect(t.status).toBe(StateStatus.Ok);
    expect(t.exitCode).toBe('code');
    expect(a.outgoing.has(tid('t1'))).toBe(true);
    expect(b.incoming.has(tid('t1'))).toBe(true);
  });

  it('SMValidationException and SMRuntimeException are distinct Error subclasses', () => {
    const ve = new SMValidationException('v');
    const re = new SMRuntimeException('r');
    expect(ve).toBeInstanceOf(Error);
    expect(re).toBeInstanceOf(Error);
    expect(ve.name).toBe('SMValidationException');
    expect(re.name).toBe('SMRuntimeException');
  });
});
