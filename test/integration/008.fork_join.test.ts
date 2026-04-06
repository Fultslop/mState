// src/__integration__/008.fork_join.test.ts
import { BasicStateMachine } from '../../src/base/BasicStateMachine';
import { StateMachineBuilder } from '../../src/base/StateMachineBuilder';
import { StateStatus } from "@src/model/State";
import type { StateMachineId, StateId, TransitionId, StateStartEvent } from '../../src/model/types';

const smid = (s: string) => s as StateMachineId;
const sid  = (s: string) => s as StateId;
const tid  = (s: string) => s as TransitionId;

function build() {
  const sm   = new BasicStateMachine(smid('parallelExecution'));
  const builder = new StateMachineBuilder(sm);
  const init = builder.createInitial(sid('initial'));
  const s1   = builder.createState(sid('init'));
  const fork = builder.createFork(sid('fork_state'));
  const a    = builder.createState(sid('RunServiceA'));
  const b    = builder.createState(sid('RunServiceB'));
  const join = builder.createJoin(sid('join_state'));
  const out  = builder.createState(sid('ProcessOutcome'));
  const term = builder.createTerminal(sid('terminal'));

  builder.createTransition(tid('initial-->init'), init.id, s1.id);
  builder.createTransition(tid('init-->fork_state'), s1.id, fork.id);
  builder.createTransition(tid('fork_state-->RunServiceA'), fork.id, a.id);
  builder.createTransition(tid('fork_state-->RunServiceB'), fork.id, b.id);
  builder.createTransition(tid('RunServiceA-->join_state'), a.id, join.id);
  builder.createTransition(tid('RunServiceB-->join_state'), b.id, join.id);
  builder.createTransition(tid('join_state-->ProcessOutcome'), join.id, out.id);
  builder.createTransition(tid('ProcessOutcome-->terminal'), out.id, term.id);
  return sm;
}

describe('spec 008 — fork/join', () => {
  it('fork emits a single onStateStart with array of two events', () => {
    const sm = build();
    sm.start();
    let forkStart: StateStartEvent[] | null = null;
    sm.onStateStart.add(e => {
      if (Array.isArray(e) && e.length === 2) forkStart = e;
    });
    sm.onStopped(sid('init'), StateStatus.Ok);
    expect(forkStart).not.toBeNull();
    const toIds = forkStart!.map(e => String(e.toStateId));
    expect(toIds).toContain('RunServiceA');
    expect(toIds).toContain('RunServiceB');
  });

  it('both fork branches are Active after fork fires', () => {
    const sm = build();
    sm.start();
    sm.onStopped(sid('init'), StateStatus.Ok);
    expect(sm.getState(sid('RunServiceA'))?.stateStatus).toBe(StateStatus.Active);
    expect(sm.getState(sid('RunServiceB'))?.stateStatus).toBe(StateStatus.Active);
  });

  it('join does not proceed until both branches complete', () => {
    const sm = build();
    sm.start();
    sm.onStopped(sid('init'), StateStatus.Ok);
    const started: string[] = [];
    sm.onStateStart.add(e => {
      const evt = Array.isArray(e) ? e[0]! : e;
      started.push(String(evt.toStateId));
    });
    sm.onStopped(sid('RunServiceA'), StateStatus.Ok);
    expect(started).not.toContain('ProcessOutcome');

    sm.onStopped(sid('RunServiceB'), StateStatus.Ok);
    expect(started).toContain('ProcessOutcome');
  });

  it('join forwards receivedPayloads to ProcessOutcome', () => {
    const sm = build();
    sm.start();
    sm.onStopped(sid('init'), StateStatus.Ok);

    const startEvts: StateStartEvent[] = [];
    sm.onStateStart.add(e => {
      const evt = Array.isArray(e) ? e[0]! : e;
      if (String(evt.toStateId) === 'ProcessOutcome') startEvts.push(evt);
    });
    sm.onStopped(sid('RunServiceA'), StateStatus.Ok, undefined, 'resultA');
    sm.onStopped(sid('RunServiceB'), StateStatus.Ok, undefined, 'resultB');

    expect(startEvts[0]).toBeDefined();
    const payload = startEvts[0]!.payload as StateStartEvent[];
    expect(Array.isArray(payload)).toBe(true);
    expect(payload).toHaveLength(2);
  });
});
