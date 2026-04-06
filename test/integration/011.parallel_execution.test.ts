import { BasicStateMachine } from '@src/base/BasicStateMachine';
import { StateMachineBuilder } from '@src/base/StateMachineBuilder';
import { StateStatus, StateType } from '@src/model/State';
import type { StateMachineId, StateId, TransitionId, StateStartEvent, StateStoppedEvent, StateMachineStoppedEvent } from '@src/model/types';

const smid = (s: string) => s as StateMachineId;
const sid  = (s: string) => s as StateId;
const tid  = (s: string) => s as TransitionId;

function buildParallelSM() {
  const sm      = new BasicStateMachine(smid('parallelExample'));
  const builder = new StateMachineBuilder(sm);

  const initRoot      = builder.createInitial(sid('initRoot'));
  const parallelGroup = builder.createParallel(sid('parallelGroup'));
  const terminal      = builder.createTerminal(sid('terminal'));

  builder.createTransition(tid('t0'), initRoot.id, parallelGroup.id);
  builder.createTransition(tid('t1'), parallelGroup.id, terminal.id);

  const region1 = parallelGroup.createRegion('region1');
  const init1   = builder.createInitial(sid('init1'));
  const exec1   = builder.createState(sid('execute1'));
  const r1t1 = builder.createTransition(tid('r1t1'), init1.id, exec1.id);
  const r1t2 = builder.createTransition(tid('r1t2'), exec1.id, region1.terminal.id);
  region1.addState(init1);
  region1.addState(exec1);
  region1.addTransition(r1t1);
  region1.addTransition(r1t2);

  const region2 = parallelGroup.createRegion('region2');
  const init2   = builder.createInitial(sid('init2'));
  const exec2   = builder.createState(sid('execute2'));
  const r2t1 = builder.createTransition(tid('r2t1'), init2.id, exec2.id);
  const r2t2 = builder.createTransition(tid('r2t2'), exec2.id, region2.terminal.id);
  region2.addState(init2);
  region2.addState(exec2);
  region2.addTransition(r2t1);
  region2.addTransition(r2t2);

  return sm;
}

describe('spec 011 — parallel execution', () => {
  it('activates both regions on start', () => {
    const sm = buildParallelSM();
    sm.start();
    const active = sm.getActiveStateIds();
    expect(active).toContain(sid('execute1'));
    expect(active).toContain(sid('execute2'));
    expect(active).toContain(sid('parallelGroup'));
  });

  it('happy path: both Ok → machine stops Ok with aggregated payload', () => {
    const sm = buildParallelSM();
    const smStopped: StateMachineStoppedEvent[] = [];
    const stateStopped: StateStoppedEvent[] = [];
    sm.onStateMachineStopped.add(e => smStopped.push(e));
    sm.onStateStopped.add(e => stateStopped.push(e));

    sm.start();
    sm.onStopped(sid('execute1'), StateStatus.Ok, undefined, 'result1');
    expect(sm.getActiveStateIds()).toContain(sid('execute2'));  // still running

    sm.onStopped(sid('execute2'), StateStatus.Ok, undefined, 'result2');

    const parallelStopped = stateStopped.find(e => e.stateId === sid('parallelGroup'));
    expect(parallelStopped?.stateStatus).toBe(StateStatus.Ok);
    expect(parallelStopped?.payload).toEqual(['result1', 'result2']);
    expect(smStopped[0]?.stateStatus).toBe(StateStatus.Ok);
  });

  it('region failure: one Error cancels siblings and exits parallel with Error', () => {
    const sm = buildParallelSM();
    const stateStopped: StateStoppedEvent[] = [];
    sm.onStateStopped.add(e => stateStopped.push(e));

    sm.start();
    sm.onStopped(sid('execute1'), StateStatus.Error);

    const exec2Stopped = stateStopped.find(e => e.stateId === sid('execute2'));
    expect(exec2Stopped?.stateStatus).toBe(StateStatus.Canceled);

    const parallelStopped = stateStopped.find(e => e.stateId === sid('parallelGroup'));
    expect(parallelStopped?.stateStatus).toBe(StateStatus.Error);
  });

  it('emits onStateStart with array covering parallel + both region starts', () => {
    const sm = buildParallelSM();
    const startEvents: (StateStartEvent | StateStartEvent[])[] = [];
    sm.onStateStart.add(e => startEvents.push(e));

    sm.start();

    const parallelStart = startEvents.find(e => !Array.isArray(e) && e.toStateId === sid('parallelGroup'));
    expect(parallelStart).toBeDefined();
    const exec1Start = startEvents.find(e => !Array.isArray(e) && e.toStateId === sid('execute1'));
    expect(exec1Start).toBeDefined();
    const exec2Start = startEvents.find(e => !Array.isArray(e) && e.toStateId === sid('execute2'));
    expect(exec2Start).toBeDefined();
  });
});
