import type { IState } from './IState';
import type { ITransition } from './ITransition';
import type { IStateMachine } from './IStateMachine';

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function sortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>)
      .sort(([ka], [kb]) => ka.localeCompare(kb))
      .map(([k, v]) => [k, sortKeys(v)]),
  );
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  if (a === null || b === null) return false;
  return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
}

export function compareStates(a: IState, b: IState): boolean {
  return (
    a.id === b.id &&
    a.type === b.type &&
    a.parentId === b.parentId &&
    setsEqual(a.incoming, b.incoming) &&
    setsEqual(a.outgoing, b.outgoing) &&
    deepEqual(a.config, b.config)
  );
}

export function compareTransitions(a: ITransition, b: ITransition): boolean {
  return (
    a.id === b.id &&
    a.fromStateId === b.fromStateId &&
    a.toStateId === b.toStateId &&
    a.status === b.status &&
    a.exitCode === b.exitCode &&
    a.parentId === b.parentId
  );
}

export function compareStateMachines(a: IStateMachine, b: IStateMachine): boolean {
  if (a.getStateCount() !== b.getStateCount()) return false;
  if (a.getTransitionCount() !== b.getTransitionCount()) return false;

  for (const id of a.getStateIds()) {
    const stateB = b.getState(id);
    if (!stateB) return false;
    if (!compareStates(a.getState(id)!, stateB)) return false;
  }
  for (const id of b.getStateIds()) {
    if (!a.getState(id)) return false;
  }

  for (const id of a.getTransitionIds()) {
    const tB = b.getTransition(id);
    if (!tB) return false;
    if (!compareTransitions(a.getTransition(id)!, tB)) return false;
  }
  for (const id of b.getTransitionIds()) {
    if (!a.getTransition(id)) return false;
  }

  return true;
}
