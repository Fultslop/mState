// src/__integration__/008.fork_join.test.ts
import { StateMachine } from '../StateMachine';
import { SMStatus } from '../types';
import type { SMStateMachineId, SMStateId, SMTransitionId, SMStateStartEvent } from '../types';

const smid = (s: string) => s as SMStateMachineId;
const sid  = (s: string) => s as SMStateId;
const tid  = (s: string) => s as SMTransitionId;

function build() {
  const sm   = new StateMachine(smid('parallelExecution'));
  const init = sm.createInitial(sid('initial'));
  const s1   = sm.createState(sid('init'));
  const fork = sm.createFork(sid('fork_state'));
  const a    = sm.createState(sid('RunServiceA'));
  const b    = sm.createState(sid('RunServiceB'));
  const join = sm.createJoin(sid('join_state'));
  const out  = sm.createState(sid('ProcessOutcome'));
  const term = sm.createTerminal(sid('terminal'));

  sm.createTransition(tid('t0'), init.id, s1.id);
  sm.createTransition(tid('t1'), s1.id, fork.id);
  sm.createTransition(tid('f1'), fork.id, a.id);
  sm.createTransition(tid('f2'), fork.id, b.id);
  sm.createTransition(tid('j1'), a.id, join.id);
  sm.createTransition(tid('j2'), b.id, join.id);
  sm.createTransition(tid('t2'), join.id, out.id);
  sm.createTransition(tid('t3'), out.id, term.id);
  return sm;
}

describe('spec 008 — fork/join', () => {
  it('fork emits a single onStateStart with array of two events', () => {
    const sm = build();
    sm.start();
    let forkStart: SMStateStartEvent[] | null = null;
    sm.onStateStart.add(e => {
      if (Array.isArray(e) && e.length === 2) forkStart = e;
    });
    sm.onStopped(sid('init'), SMStatus.Ok);
    expect(forkStart).not.toBeNull();
    const toIds = forkStart!.map(e => String(e.toStateId));
    expect(toIds).toContain('RunServiceA');
    expect(toIds).toContain('RunServiceB');
  });

  it('both fork branches are Active after fork fires', () => {
    const sm = build();
    sm.start();
    sm.onStopped(sid('init'), SMStatus.Ok);
    expect(sm.getState(sid('RunServiceA'))?.stateStatus).toBe(SMStatus.Active);
    expect(sm.getState(sid('RunServiceB'))?.stateStatus).toBe(SMStatus.Active);
  });

  it('join does not proceed until both branches complete', () => {
    const sm = build();
    sm.start();
    sm.onStopped(sid('init'), SMStatus.Ok);
    const started: string[] = [];
    sm.onStateStart.add(e => {
      const evt = Array.isArray(e) ? e[0]! : e;
      started.push(String(evt.toStateId));
    });
    sm.onStopped(sid('RunServiceA'), SMStatus.Ok);
    expect(started).not.toContain('ProcessOutcome');

    sm.onStopped(sid('RunServiceB'), SMStatus.Ok);
    expect(started).toContain('ProcessOutcome');
  });

  it('join forwards receivedPayloads to ProcessOutcome', () => {
    const sm = build();
    sm.start();
    sm.onStopped(sid('init'), SMStatus.Ok);

    const startEvts: SMStateStartEvent[] = [];
    sm.onStateStart.add(e => {
      const evt = Array.isArray(e) ? e[0]! : e;
      if (String(evt.toStateId) === 'ProcessOutcome') startEvts.push(evt);
    });
    sm.onStopped(sid('RunServiceA'), SMStatus.Ok, undefined, 'resultA');
    sm.onStopped(sid('RunServiceB'), SMStatus.Ok, undefined, 'resultB');

    expect(startEvts[0]).toBeDefined();
    const payload = startEvts[0]!.payload as import('../types').SMStateStartEvent[];
    expect(Array.isArray(payload)).toBe(true);
    expect(payload).toHaveLength(2);
  });
});
