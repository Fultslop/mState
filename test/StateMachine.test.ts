import { StateType, StateStatus } from "@src/IState";
import type { StateMachineId, StateId, TransitionId, StateMachineStoppedEvent, StateStartEvent } from '@src/types';
import { BasicStateMachine } from '@src/BasicStateMachine';
import { SMValidationException, SMRuntimeException } from '@src/exceptions';
import { StateMachine } from "@src/index";
import { StateMachineBuilder } from "@src/StateMachineBuilder";

const smid = (s: string) => s as StateMachineId;
const sid  = (s: string) => s as StateId;
const tid  = (s: string) => s as TransitionId;

describe('StateMachine construction', () => {
  it('stores its id', () => {
    const sm = new BasicStateMachine(smid('test'));
    expect(sm.id).toBe(smid('test'));
  });

  it('starts with zero states and transitions', () => {
    const sm = new BasicStateMachine(smid('test'));
    expect(sm.getStateCount()).toBe(0);
    expect(sm.getTransitionCount()).toBe(0);
  });

  it('createInitial adds an Initial state', () => {
    
    const sm = new BasicStateMachine(smid('test'));
    const builder = new StateMachineBuilder(sm);

    const s = builder.createInitial(sid('init'));

    expect(s.type).toBe(StateType.Initial);
    expect(sm.getState(sid('init'))).toBe(s);
    expect(sm.getStateCount()).toBe(1);
  });

  it('createState adds a UserDefined state', () => {
    const sm = new BasicStateMachine(smid('test'));
    const builder = new StateMachineBuilder(sm);

    const s = builder.createState(sid('s1'), { x: 1 });
    expect(s.type).toBe(StateType.UserDefined);
    expect(s.config).toEqual({ x: 1 });
  });

  it('createTerminal adds a Terminal state', () => {
    const sm = new BasicStateMachine(smid('test'));
    const builder = new StateMachineBuilder(sm);
    const s = builder.createTerminal(sid('term'));
    
    expect(s.type).toBe(StateType.Terminal);
  });

  it('createChoice adds a Choice state', () => {
    const sm = new BasicStateMachine(smid('test'));
    const builder = new StateMachineBuilder(sm);
    const s = builder.createChoice(sid('ch'));
    
    expect(s.type).toBe(StateType.Choice);
  });

  it('createFork adds a Fork state', () => {
    const sm = new BasicStateMachine(smid('test'));
    const builder = new StateMachineBuilder(sm);
    
    const s = builder.createFork(sid('f'));
    expect(s.type).toBe(StateType.Fork);
  });

  it('createJoin adds a Join state', () => {
    const sm = new BasicStateMachine(smid('test'));
    const builder = new StateMachineBuilder(sm);

    const s = builder.createJoin(sid('j'));
    expect(s.type).toBe(StateType.Join);
  });

  it('createGroup adds a Group state', () => {
    const sm = new BasicStateMachine(smid('test'));
    const builder = new StateMachineBuilder(sm);
    const g = builder.createGroup(sid('g'));
    expect(g.type).toBe(StateType.Group);
  });

  it('createTransition wires incoming/outgoing sets', () => {
    const sm = new BasicStateMachine(smid('test'));
    const builder = new StateMachineBuilder(sm);
    const a = builder.createState(sid('a'));
    const b = builder.createState(sid('b'));
    builder.createTransition(tid('t1'), sid('a'), sid('b'));
    expect(a.outgoing.has(tid('t1'))).toBe(true);
    expect(b.incoming.has(tid('t1'))).toBe(true);
    expect(sm.getTransitionCount()).toBe(1);
  });

  it('validate() throws SMValidationException for invalid graph', () => {
    const sm = new BasicStateMachine(smid('test'));
    const builder = new StateMachineBuilder(sm);
    builder.createState(sid('s1')); // no initial, invalid
    expect(() => sm.validate()).toThrow(SMValidationException);
  });

  it('getStateIds and getTransitionIds return current ids', () => {
    const sm = new BasicStateMachine(smid('test'));
    const builder = new StateMachineBuilder(sm);
    builder.createState(sid('a'));
    expect(sm.getStateIds()).toContain(sid('a'));
    sm.deleteState(sid('a'));
    expect(sm.getStateIds()).not.toContain(sid('a'));
  });
});

// Helper: minimal valid SM (init → s1 → term)
function makeMinimalSM() {
  const sm = new BasicStateMachine(smid('sm'));
  const builder = new StateMachineBuilder(sm);
  const init = builder.createInitial(sid('init'));
  const s1   = builder.createState(sid('s1'));
  const term = builder.createTerminal(sid('term'));
  builder.createTransition(tid('t0'), init.id, s1.id);
  builder.createTransition(tid('t1'), s1.id, term.id);
  return { sm, init, s1, term };
}

describe('StateMachine.start()', () => {
  it('throws SMRuntimeException when no Initial state exists', () => {
    const sm = new BasicStateMachine(smid('sm'));
    const builder = new StateMachineBuilder(sm);
    builder.createState(sid('s1'));
    expect(() => sm.start()).toThrow(SMRuntimeException);
  });

  it('emits onSMStarted then onStateStart for first real state', () => {
    const { sm } = makeMinimalSM();
    const events: string[] = [];
    sm.onStateMachineStarted.add(e => events.push(`started:${e.statemachineId}`));
    sm.onStateStart.add(e => {
      const evt = Array.isArray(e) ? e[0]! : e;
      events.push(`stateStart:${evt.toStateId}`);
    });
    sm.start();
    expect(events).toEqual(['started:sm', 'stateStart:s1']);
  });

  it('sets the first real state to Active', () => {
    const { sm, s1 } = makeMinimalSM();
    sm.start();
    expect(s1.stateStatus).toBe(StateStatus.Active);
    expect(sm.getActiveStateIds()).toContain(sid('s1'));
  });
});

describe('StateMachine.onStopped()', () => {
  it('throws when state is unknown', () => {
    const { sm } = makeMinimalSM();
    sm.start();
    expect(() => sm.onStopped(sid('ghost'), StateStatus.Ok)).toThrow(SMRuntimeException);
  });

  it('throws when state is not Active', () => {
    const { sm } = makeMinimalSM();
    sm.start();
    // s1 is active; trying to stop a non-active state
    expect(() => sm.onStopped(sid('init'), StateStatus.Ok)).toThrow(SMRuntimeException);
  });

  it('emits onStateStopped then onSMStopped when reaching Terminal', () => {
    const { sm } = makeMinimalSM();
    const events: string[] = [];
    sm.onStateStopped.add(e => events.push(`stopped:${e.stateId}`));
    sm.onStateMachineStopped.add(e => events.push(`smStopped:${e.stateStatus}`));
    sm.start();
    sm.onStopped(sid('s1'), StateStatus.Ok);
    expect(events).toEqual(['stopped:s1', 'smStopped:ok']);
  });

  it('routes to next state on non-terminal transition', () => {
    const sm = new BasicStateMachine(smid('sm'));
    const builder = new StateMachineBuilder(sm);
    const init = builder.createInitial(sid('init'));
    const s1   = builder.createState(sid('s1'));
    const s2   = builder.createState(sid('s2'));
    const term = builder.createTerminal(sid('term'));
    builder.createTransition(tid('t0'), init.id, s1.id);
    builder.createTransition(tid('t1'), s1.id, s2.id);
    builder.createTransition(tid('t2'), s2.id, term.id);
    sm.start();

    const events: string[] = [];
    sm.onStateStart.add(e => {
      const evt = Array.isArray(e) ? e[0]! : e;
      events.push(`start:${evt.toStateId}`);
    });
    sm.onStopped(sid('s1'), StateStatus.Ok);
    expect(events).toEqual(['start:s2']);
    expect(s2.stateStatus).toBe(StateStatus.Active);
  });

  it('emits onSMStopped with Error when narrowed transition does not match', () => {
    const sm = new BasicStateMachine(smid('sm'));
    const builder = new StateMachineBuilder(sm);
    const init = builder.createInitial(sid('init'));
    const s1   = builder.createState(sid('s1'));
    const s2   = builder.createState(sid('s2'));
    const term = builder.createTerminal(sid('term'));
    builder.createTransition(tid('t0'), init.id, s1.id);
    builder.createTransition(tid('t1'), s1.id, s2.id, StateStatus.Ok);
    builder.createTransition(tid('t2'), s2.id, term.id);

    sm.start();
    const smStopped: StateMachineStoppedEvent[] = [];
    sm.onStateMachineStopped.add(e => smStopped.push(e));
    sm.onStopped(sid('s1'), StateStatus.Error); // doesn't match Ok
    expect(smStopped[0]?.stateStatus).toBe(StateStatus.Error);
  });

  it('Fork: emits array onStateStart and activates all branches', () => {
    const sm   = new BasicStateMachine(smid('sm'));
    const builder = new StateMachineBuilder(sm);
    const init = builder.createInitial(sid('init'));
    const s1   = builder.createState(sid('s1'));
    const fork = builder.createFork(sid('fork'));
    const a    = builder.createState(sid('a'));
    const b    = builder.createState(sid('b'));
    const join = builder.createJoin(sid('join'));
    const out  = builder.createState(sid('out'));
    const term = builder.createTerminal(sid('term'));
    builder.createTransition(tid('t0'), init.id, s1.id);
    builder.createTransition(tid('t1'), s1.id, fork.id);
    builder.createTransition(tid('f1'), fork.id, a.id);
    builder.createTransition(tid('f2'), fork.id, b.id);
    builder.createTransition(tid('j1'), a.id, join.id);
    builder.createTransition(tid('j2'), b.id, join.id);
    builder.createTransition(tid('t2'), join.id, out.id);
    builder.createTransition(tid('t3'), out.id, term.id);

    sm.start();
    let forkEvents: StateStartEvent[] | null = null;
    sm.onStateStart.add(e => {
      if (Array.isArray(e)) forkEvents = e;
    });
    sm.onStopped(sid('s1'), StateStatus.Ok); // enters fork

    expect(forkEvents).not.toBeNull();
    expect(forkEvents!).toHaveLength(2);
    expect(a.stateStatus).toBe(StateStatus.Active);
    expect(b.stateStatus).toBe(StateStatus.Active);
  });

  it('Join: waits for all branches then routes forward', () => {
    const sm   = new BasicStateMachine(smid('sm'));
    const builder = new StateMachineBuilder(sm);
    const init = builder.createInitial(sid('init'));
    const s1   = builder.createState(sid('s1'));
    const fork = builder.createFork(sid('fork'));
    const a    = builder.createState(sid('a'));
    const b    = builder.createState(sid('b'));
    const join = builder.createJoin(sid('join'));
    const out  = builder.createState(sid('out'));
    const term = builder.createTerminal(sid('term'));
    builder.createTransition(tid('t0'), init.id, s1.id);
    builder.createTransition(tid('t1'), s1.id, fork.id);
    builder.createTransition(tid('f1'), fork.id, a.id);
    builder.createTransition(tid('f2'), fork.id, b.id);
    builder.createTransition(tid('j1'), a.id, join.id);
    builder.createTransition(tid('j2'), b.id, join.id);
    builder.createTransition(tid('t2'), join.id, out.id);
    builder.createTransition(tid('t3'), out.id, term.id);

    sm.start();
    sm.onStopped(sid('s1'), StateStatus.Ok);

    const afterJoin: string[] = [];
    sm.onStateStart.add(e => {
      const evt = Array.isArray(e) ? e[0]! : e;
      afterJoin.push(evt.toStateId);
    });

    sm.onStopped(sid('a'), StateStatus.Ok, undefined, 'payloadA');
    expect(out.stateStatus).not.toBe(StateStatus.Active); // b not done yet
    sm.onStopped(sid('b'), StateStatus.Ok, undefined, 'payloadB');
    expect(afterJoin).toContain(sid('out'));
    expect(out.stateStatus).toBe(StateStatus.Active);
  });
});

describe('StateMachine.stop()', () => {
  it('emits onSMStopped with Canceled and clears active states', () => {
    const { sm, s1 } = makeMinimalSM();
    sm.start();
    expect(sm.getActiveStateIds()).toContain(sid('s1'));

    const events: StateMachineStoppedEvent[] = [];
    sm.onStateMachineStopped.add(e => events.push(e));
    sm.stop();

    expect(events[0]?.stateStatus).toBe(StateStatus.Canceled);
    expect(s1.stateStatus).toBe(StateStatus.Canceled);
    expect(sm.getActiveStateIds()).toHaveLength(0);
  });
});
