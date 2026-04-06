import type { State } from '../model/State';
import type { Transition } from '../model/Transition';
import type { StateMachine } from '../model/StateMachine';

function setsEqual<T>(setA: Set<T>, setB: Set<T>): boolean {
  if (setA.size !== setB.size) {
    return false;
  }
  for (const v of setA) {
    if (!setB.has(v)) {
      return false;
    }
  }
  return true;
}

function sortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
return obj;
}
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>)
      .sort(([ka], [kb]) => ka.localeCompare(kb))
      .map(([k, v]) => [k, sortKeys(v)]),
  );
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
return true;
}
  if (a === undefined || b === undefined) {
return false;
}
  if (a === null || b === null) {
return false;
}
  return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
}

export function compareStates(a: State, b: State): boolean {
  return (
    a.id === b.id &&
    a.type === b.type &&
    a.parentId === b.parentId &&
    setsEqual(a.incoming, b.incoming) &&
    setsEqual(a.outgoing, b.outgoing) &&
    deepEqual(a.config, b.config)
  );
}

export function compareTransitions(a: Transition, b: Transition): boolean {
  return (
    a.id === b.id &&
    a.fromStateId === b.fromStateId &&
    a.toStateId === b.toStateId &&
    a.status === b.status &&
    a.exitCode === b.exitCode &&
    a.parentId === b.parentId
  );
}

/**
 * Check if both machines have the same states and
 * transitions
 * @param a 
 * @param b 
 * @returns 
 */
function hasEqualElementCounts(a: StateMachine, b: StateMachine): boolean {
  return (a.getStateCount() === b.getStateCount()) 
    &&  (a.getTransitionCount() === b.getTransitionCount());
}

function hasSameStates(a: StateMachine, b: StateMachine): boolean {
  return a.getStateIds().every( id => {
      const stateB = b.getState(id);
      return stateB
        && compareStates(a.getState(id)!, stateB);
    })
    && b.getStateIds().every( id => a.getState(id));
}

function hasSameTransitions(a: StateMachine, b: StateMachine): boolean {
  return a.getTransitionIds().every( id => {
      const transitionB = b.getTransition(id);
      return transitionB
        && compareTransitions(a.getTransition(id)!, transitionB);
    })
    && b.getTransitionIds().every( id => a.getTransition(id));
}

export function compareStateMachines(a: StateMachine, b: StateMachine): boolean {
  return hasEqualElementCounts(a,b)
    && hasSameStates(a,b) 
    && hasSameTransitions(a,b);
}

