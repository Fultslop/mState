import { MermaidParser } from '@src/parser/MermaidParser';
import { StateType, StateStatus } from "@src/model/State";

const SIMPLE = `
---
title: simple
---
stateDiagram-v2
  [*] --> init
  init --> execute
  execute --> [*]
`;

const CHOICE = `
---
title: choiceExample
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

const EXIT_CODE = `
---
title: exitCode
---
stateDiagram-v2
  state ch <<choice>>
  [*] --> s1
  s1 --> ch
  ch --> s2: Ok/planA
  ch --> s3: Ok/planB
  s2 --> [*]
  s3 --> [*]
`;

const FORK_JOIN = `
---
title: forkJoin
---
stateDiagram-v2
  state fork_state <<fork>>
  state join_state <<join>>
  [*] --> init
  init --> fork_state
  fork_state --> serviceA
  fork_state --> serviceB
  serviceA --> join_state
  serviceB --> join_state
  join_state --> processOutcome
  processOutcome --> [*]
`;

const GROUP = `
---
title: groupExample
---
stateDiagram-v2
  state group {
    [*] --> step1
    step1 --> [*]
  }
  [*] --> group
  group --> [*]
`;

describe('MermaidParser', () => {
  it('extracts the diagram title', () => {
    const sm = new MermaidParser().parse(SIMPLE);
    expect(sm.id).toBe('simple');
  });

  it('creates Initial, UserDefined, and Terminal states for simple diagram', () => {
    const sm = new MermaidParser().parse(SIMPLE);
    const ids = sm.getStateIds();
    expect(ids.some(id => sm.getState(id)?.type === StateType.Initial)).toBe(true);
    expect(ids.some(id => sm.getState(id)?.type === StateType.Terminal)).toBe(true);
    expect(ids.some(id => String(id) === 'init')).toBe(true);
    expect(ids.some(id => String(id) === 'execute')).toBe(true);
  });

  it('creates correct transition count for simple diagram', () => {
    const sm = new MermaidParser().parse(SIMPLE);
    expect(sm.getTransitionCount()).toBe(3); // [*]→init, init→execute, execute→[*]
  });

  it('creates a Choice state for <<choice>> declaration', () => {
    const sm = new MermaidParser().parse(CHOICE);
    const choiceId = sm.getStateIds().find(id => sm.getState(id)?.type === StateType.Choice);
    expect(choiceId).toBeDefined();
    expect(String(choiceId)).toBe('loadConfigChoice');
  });

  it('attaches status to transitions with bare labels', () => {
    const sm = new MermaidParser().parse(CHOICE);
    const allIds = sm.getTransitionIds();
    const okT = allIds.map(id => sm.getTransition(id)).find(
      t => t?.status === StateStatus.Ok
    );
    expect(okT).toBeDefined();
    expect(String(okT!.toStateId)).toBe('execute');
  });

  it('parses Ok/planA transition label into status+exitCode', () => {
    const sm = new MermaidParser().parse(EXIT_CODE);
    const allIds = sm.getTransitionIds();
    const planA = allIds.map(id => sm.getTransition(id)).find(
      t => t?.exitCode === 'planA'
    );
    expect(planA).toBeDefined();
    expect(planA!.status).toBe(StateStatus.Ok);
    expect(String(planA!.toStateId)).toBe('s2');
  });

  it('creates Fork and Join states', () => {
    const sm = new MermaidParser().parse(FORK_JOIN);
    const ids = sm.getStateIds();
    expect(ids.some(id => sm.getState(id)?.type === StateType.Fork)).toBe(true);
    expect(ids.some(id => sm.getState(id)?.type === StateType.Join)).toBe(true);
  });

  it('creates a Group state and registers its members', () => {
    const sm = new MermaidParser().parse(GROUP);
    const groupId = sm.getStateIds().find(id => sm.getState(id)?.type === StateType.Group);
    expect(groupId).toBeDefined();
    expect(String(groupId)).toBe('group');
  });
});
