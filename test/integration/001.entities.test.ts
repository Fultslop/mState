// src/__integration__/001.entities.test.ts
// Verifies all entity types are constructable and branded IDs are distinct types.
import { StateMachine } from '../../src/StateMachine';
import { SMStatus, SMStateType } from '../../src/types';
import type { SMStateMachineId, SMStateId, SMTransitionId } from '../../src/types';
import { SMValidationException, SMRuntimeException } from '../../src/exceptions';

const smid = (s: string) => s as SMStateMachineId;
const sid  = (s: string) => s as SMStateId;
const tid  = (s: string) => s as SMTransitionId;

describe('spec 001 — entities', () => {
  it('creates all state types without error', () => {
    const sm = new StateMachine(smid('entities'));
    expect(() => {
      sm.createInitial(sid('init'));
      sm.createState(sid('s1'));
      sm.createTerminal(sid('term'));
      sm.createChoice(sid('ch'));
      sm.createFork(sid('fork'));
      sm.createJoin(sid('join'));
      sm.createGroup(sid('group'));
    }).not.toThrow();
    expect(sm.getStateCount()).toBe(7);
  });

  it('each state type has the correct SMStateType', () => {
    const sm = new StateMachine(smid('types'));
    expect(sm.createInitial(sid('i')).type).toBe(SMStateType.Initial);
    expect(sm.createState(sid('s')).type).toBe(SMStateType.UserDefined);
    expect(sm.createTerminal(sid('t')).type).toBe(SMStateType.Terminal);
    expect(sm.createChoice(sid('c')).type).toBe(SMStateType.Choice);
    expect(sm.createFork(sid('f')).type).toBe(SMStateType.Fork);
    expect(sm.createJoin(sid('j')).type).toBe(SMStateType.Join);
    expect(sm.createGroup(sid('g')).type).toBe(SMStateType.Group);
  });

  it('states begin with SMStatus.None', () => {
    const sm = new StateMachine(smid('status'));
    const s = sm.createState(sid('s1'));
    expect(s.stateStatus).toBe(SMStatus.None);
  });

  it('createTransition wires incoming/outgoing and returns the transition', () => {
    const sm = new StateMachine(smid('trans'));
    const a = sm.createState(sid('a'));
    const b = sm.createState(sid('b'));
    const t = sm.createTransition(tid('t1'), sid('a'), sid('b'), SMStatus.Ok, 'code');
    expect(t.id).toBe(tid('t1'));
    expect(t.fromStateId).toBe(sid('a'));
    expect(t.toStateId).toBe(sid('b'));
    expect(t.status).toBe(SMStatus.Ok);
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
