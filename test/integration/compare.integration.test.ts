// test/integration/compare.integration.test.ts
//
// For each integration scenario (002-009), verifies that the programmatically-built
// state machine matches the equivalent machine parsed from a Mermaid diagram.
//
import { BasicStateMachine } from '../../src/base/BasicStateMachine';
import { StateMachineBuilder } from '../../src/base/StateMachineBuilder';
import { MermaidParser } from '../../src/parser/MermaidParser';
import { StateStatus } from '../../src/model/State';
import { compareStateMachines } from '../../src/base/compare';
import type { StateMachineId, StateId, TransitionId } from '../../src/model/types';

const smid = (s: string) => s as StateMachineId;
const sid  = (s: string) => s as StateId;
const tid  = (s: string) => s as TransitionId;
const parse = (diagram: string) => new MermaidParser().parse(diagram);

// ── 002 — basic single state ──────────────────────────────────────────────

const MERMAID_002 = `
---
title: 002
---
stateDiagram-v2
  [*] --> initialize
  initialize --> [*]
`;

function build002() {
  const sm   = new BasicStateMachine(smid('basicExample'));
  const b    = new StateMachineBuilder(sm);
  const init = b.createInitial(sid('initial'));
  const s1   = b.createState(sid('initialize'));
  const term = b.createTerminal(sid('terminal'));
  b.createTransition(tid('initial-->initialize'), init.id, s1.id);
  b.createTransition(tid('initialize-->terminal'), s1.id, term.id);
  return sm;
}

// ── 003 — basic transition ────────────────────────────────────────────────

const MERMAID_003 = `
---
title: 003
---
stateDiagram-v2
  [*] --> init
  init --> execute
  execute --> [*]
`;

function build003() {
  const sm   = new BasicStateMachine(smid('basicTransition'));
  const b    = new StateMachineBuilder(sm);
  const init = b.createInitial(sid('initial'));
  const s1   = b.createState(sid('init'));
  const s2   = b.createState(sid('execute'));
  const term = b.createTerminal(sid('terminal'));
  b.createTransition(tid('initial-->init'), init.id, s1.id);
  b.createTransition(tid('init-->execute'), s1.id, s2.id);
  b.createTransition(tid('execute-->terminal'), s2.id, term.id);
  return sm;
}

// ── 004 — transition narrowing ────────────────────────────────────────────

const MERMAID_004 = `
---
title: 004
---
stateDiagram-v2
  [*] --> loadConfig
  loadConfig --> execute: ok
  execute --> [*]
`;

function build004() {
  const sm   = new BasicStateMachine(smid('transitionNarrowing'));
  const b    = new StateMachineBuilder(sm);
  const init = b.createInitial(sid('initial'));
  const lc   = b.createState(sid('loadConfig'));
  const exec = b.createState(sid('execute'));
  const term = b.createTerminal(sid('terminal'));
  b.createTransition(tid('initial-->loadConfig'), init.id, lc.id);
  b.createTransition(tid('loadConfig-->execute:ok'), lc.id, exec.id, StateStatus.Ok);
  b.createTransition(tid('execute-->terminal'), exec.id, term.id);
  return sm;
}

// ── 005 — transition selection via Choice ─────────────────────────────────

const MERMAID_005 = `
---
title: 005
---
stateDiagram-v2
  state loadConfigChoice <<choice>>
  [*] --> loadConfig
  loadConfig --> loadConfigChoice
  loadConfigChoice --> execute: ok
  loadConfigChoice --> logError: error
  execute --> [*]
  logError --> [*]
`;

function build005() {
  const sm   = new BasicStateMachine(smid('transitionSelection'));
  const b    = new StateMachineBuilder(sm);
  const init = b.createInitial(sid('initial'));
  const lc   = b.createState(sid('loadConfig'));
  const ch   = b.createChoice(sid('loadConfigChoice'));
  const exec = b.createState(sid('execute'));
  const err  = b.createState(sid('logError'));
  const term = b.createTerminal(sid('terminal'));
  b.createTransition(tid('initial-->loadConfig'), init.id, lc.id);
  b.createTransition(tid('loadConfig-->loadConfigChoice'), lc.id, ch.id);
  b.createTransition(tid('loadConfigChoice-->execute:ok'), ch.id, exec.id, StateStatus.Ok);
  b.createTransition(tid('loadConfigChoice-->logError:error'), ch.id, err.id, StateStatus.Error);
  b.createTransition(tid('execute-->terminal'), exec.id, term.id);
  b.createTransition(tid('logError-->terminal'), err.id, term.id);
  return sm;
}

// ── 006 — transition by exit code ────────────────────────────────────────

const MERMAID_006 = `
---
title: 006
---
stateDiagram-v2
  state ch <<choice>>
  [*] --> loadConfig
  loadConfig --> ch
  ch --> execute_a: Ok/planA
  ch --> execute_b: Ok/planB
  ch --> logError: any
  execute_a --> [*]
  execute_b --> [*]
  logError --> [*]
`;

function build006() {
  const sm   = new BasicStateMachine(smid('exitCode'));
  const b    = new StateMachineBuilder(sm);
  const init = b.createInitial(sid('initial'));
  const lc   = b.createState(sid('loadConfig'));
  const ch   = b.createChoice(sid('ch'));
  const a    = b.createState(sid('execute_a'));
  const bst  = b.createState(sid('execute_b'));
  const err  = b.createState(sid('logError'));
  const term = b.createTerminal(sid('terminal'));
  b.createTransition(tid('initial-->loadConfig'), init.id, lc.id);
  b.createTransition(tid('loadConfig-->ch'), lc.id, ch.id);
  b.createTransition(tid('ch-->execute_a:ok/planA'), ch.id, a.id, StateStatus.Ok, 'planA');
  b.createTransition(tid('ch-->execute_b:ok/planB'), ch.id, bst.id, StateStatus.Ok, 'planB');
  b.createTransition(tid('ch-->logError:any'), ch.id, err.id, StateStatus.AnyStatus);
  b.createTransition(tid('execute_a-->terminal'), a.id, term.id);
  b.createTransition(tid('execute_b-->terminal'), bst.id, term.id);
  b.createTransition(tid('logError-->terminal'), err.id, term.id);
  return sm;
}

// ── 007 — payloads ────────────────────────────────────────────────────────
// Same topology as 003; verifies structural match independent of runtime payloads.

const MERMAID_007 = `
---
title: 007
---
stateDiagram-v2
  [*] --> init
  init --> execute
  execute --> [*]
`;

function build007() {
  const sm   = new BasicStateMachine(smid('payloads'));
  const b    = new StateMachineBuilder(sm);
  const init = b.createInitial(sid('initial'));
  const s1   = b.createState(sid('init'));
  const s2   = b.createState(sid('execute'));
  const term = b.createTerminal(sid('terminal'));
  b.createTransition(tid('initial-->init'), init.id, s1.id);
  b.createTransition(tid('init-->execute'), s1.id, s2.id);
  b.createTransition(tid('execute-->terminal'), s2.id, term.id);
  return sm;
}

// ── 008 — fork/join ───────────────────────────────────────────────────────

const MERMAID_008 = `
---
title: 008
---
stateDiagram-v2
  state fork_state <<fork>>
  state join_state <<join>>
  [*] --> init
  init --> fork_state
  fork_state --> RunServiceA
  fork_state --> RunServiceB
  RunServiceA --> join_state
  RunServiceB --> join_state
  join_state --> ProcessOutcome
  ProcessOutcome --> [*]
`;

function build008() {
  const sm   = new BasicStateMachine(smid('parallelExecution'));
  const b    = new StateMachineBuilder(sm);
  const init = b.createInitial(sid('initial'));
  const s1   = b.createState(sid('init'));
  const fork = b.createFork(sid('fork_state'));
  const a    = b.createState(sid('RunServiceA'));
  const bst  = b.createState(sid('RunServiceB'));
  const join = b.createJoin(sid('join_state'));
  const out  = b.createState(sid('ProcessOutcome'));
  const term = b.createTerminal(sid('terminal'));
  b.createTransition(tid('initial-->init'), init.id, s1.id);
  b.createTransition(tid('init-->fork_state'), s1.id, fork.id);
  b.createTransition(tid('fork_state-->RunServiceA'), fork.id, a.id);
  b.createTransition(tid('fork_state-->RunServiceB'), fork.id, bst.id);
  b.createTransition(tid('RunServiceA-->join_state'), a.id, join.id);
  b.createTransition(tid('RunServiceB-->join_state'), bst.id, join.id);
  b.createTransition(tid('join_state-->ProcessOutcome'), join.id, out.id);
  b.createTransition(tid('ProcessOutcome-->terminal'), out.id, term.id);
  return sm;
}

// ── 009 — group execution ─────────────────────────────────────────────────

const MERMAID_009 = `
---
title: 009
---
stateDiagram-v2
  state groupChoice <<choice>>
  state group {
    [*] --> step1
    step1 --> step2: ok
    step2 --> [*]: ok
  }
  [*] --> group
  group --> groupChoice
  groupChoice --> [*]
  groupChoice --> logError: error
  logError --> [*]
`;

function build009() {
  const sm        = new BasicStateMachine(smid('groupExample'));
  const b         = new StateMachineBuilder(sm);
  const rootInit  = b.createInitial(sid('initial'));
  const group     = b.createGroup(sid('group'));
  const groupInit = b.createInitial(sid('group__initial'));
  const step1     = b.createState(sid('step1'));
  const step2     = b.createState(sid('step2'));
  const groupTerm = b.createTerminal(sid('group__terminal'));
  const ch        = b.createChoice(sid('groupChoice'));
  const logErr    = b.createState(sid('logError'));
  const rootTerm  = b.createTerminal(sid('terminal'));

  group.addState(groupInit);
  group.addState(step1);
  group.addState(step2);
  group.addState(groupTerm);

  b.createTransition(tid('initial-->group'), rootInit.id, group.id);
  b.createTransition(tid('group-->groupChoice'), group.id, ch.id);
  b.createTransition(tid('groupChoice-->terminal'), ch.id, rootTerm.id);
  b.createTransition(tid('groupChoice-->logError:error'), ch.id, logErr.id, StateStatus.Error);
  b.createTransition(tid('logError-->terminal'), logErr.id, rootTerm.id);
  b.createTransition(tid('group__initial-->step1'), groupInit.id, step1.id);
  b.createTransition(tid('step1-->step2:ok'), step1.id, step2.id, StateStatus.Ok);
  b.createTransition(tid('step2-->group__terminal:ok'), step2.id, groupTerm.id, StateStatus.Ok);

  return sm;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('compare integration — builder vs Mermaid parser', () => {
  it('002: basic single state', () => {
    expect(compareStateMachines(build002(), parse(MERMAID_002))).toBe(true);
  });

  it('003: basic transition', () => {
    expect(compareStateMachines(build003(), parse(MERMAID_003))).toBe(true);
  });

  it('004: transition narrowing (ok guard)', () => {
    expect(compareStateMachines(build004(), parse(MERMAID_004))).toBe(true);
  });

  it('005: choice routing', () => {
    expect(compareStateMachines(build005(), parse(MERMAID_005))).toBe(true);
  });

  it('006: exit code routing', () => {
    expect(compareStateMachines(build006(), parse(MERMAID_006))).toBe(true);
  });

  it('007: payload machine topology', () => {
    expect(compareStateMachines(build007(), parse(MERMAID_007))).toBe(true);
  });

  it('008: fork/join', () => {
    expect(compareStateMachines(build008(), parse(MERMAID_008))).toBe(true);
  });

  it('009: group execution', () => {
    expect(compareStateMachines(build009(), parse(MERMAID_009))).toBe(true);
  });
});
