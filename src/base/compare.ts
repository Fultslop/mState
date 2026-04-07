/* eslint-disable valid-typeof */
import type { State } from '../model/State';
import type { Transition } from '../model/Transition';
import type { StateMachine } from '../model/StateMachine';

const TYPE_OBJECT = 'object';

function setsEqual<T>(setA: Set<T>, setB: Set<T>): boolean {
  let result = true;
  if (setA.size !== setB.size) {
    result = false;
  } else {
    for (const value of setA) {
      if (!setB.has(value)) {
        result = false;
      }
    }
  }
  return result;
}

type CompareFunc = (valueA: unknown, valueB: unknown) => boolean;

function arraysDeepEqual(
  arrA: unknown[],
  arrB: unknown[],
  compareFunc: CompareFunc,
): boolean {
  if (arrA.length !== arrB.length) {
    return false;
  }
  return arrA.every((value, index) => compareFunc(value, arrB[index]));
}

function objectsDeepEqual(
  objA: Record<string, unknown>,
  objB: Record<string, unknown>,
  compareFunc: CompareFunc,
): boolean {
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  if (keysA.length !== keysB.length) {
    return false;
  }
  return keysA.every(
    (key) => Object.prototype.hasOwnProperty.call(objB, key) && compareFunc(objA[key], objB[key]),
  );
}

function deepEqual(
  valueA: unknown,
  valueB: unknown,
): boolean {
  if (valueA === valueB) {
    return true;
  }
  if (valueA === undefined) {
    return false;
  }
  if (valueB === undefined) {
    return false;
  }
  if (valueA === null) {
    return false;
  }
  if (valueB === null) {
    return false;
  }
  if (typeof valueA !== TYPE_OBJECT) {
    return false;
  }
  if (typeof valueB !== TYPE_OBJECT) {
    return false;
  }
  const isArrayA = Array.isArray(valueA);
  if (isArrayA !== Array.isArray(valueB)) {
    return false;
  }
  if (isArrayA) {
    return arraysDeepEqual(valueA as unknown[], valueB as unknown[], deepEqual);
  }
  return objectsDeepEqual(
    valueA as Record<string, unknown>,
    valueB as Record<string, unknown>,
    deepEqual,
  );
}

export function compareStates(
  stateA: State,
  stateB: State,
): boolean {
  return (
    stateA.id === stateB.id &&
    stateA.type === stateB.type &&
    stateA.parentId === stateB.parentId &&
    setsEqual(stateA.incoming, stateB.incoming) &&
    setsEqual(stateA.outgoing, stateB.outgoing) &&
    deepEqual(stateA.config, stateB.config)
  );
}

export function compareTransitions(
  transitionA: Transition,
  transitionB: Transition,
): boolean {
  return (
    transitionA.id === transitionB.id &&
    transitionA.fromStateId === transitionB.fromStateId &&
    transitionA.toStateId === transitionB.toStateId &&
    transitionA.status === transitionB.status &&
    transitionA.exitCode === transitionB.exitCode &&
    transitionA.parentId === transitionB.parentId
  );
}

/**
 * Check if both machines have the same states and
 * transitions
 * @param stateMachineA
 * @param stateMachineB
 * @returns
 */
function hasEqualElementCounts(
  stateMachineA: StateMachine,
  stateMachineB: StateMachine,
): boolean {
  return (
    stateMachineA.getStateCount() ===
      stateMachineB.getStateCount() &&
    stateMachineA.getTransitionCount() ===
      stateMachineB.getTransitionCount()
  );
}

function hasSameStates(
  stateMachineA: StateMachine,
  stateMachineB: StateMachine,
): boolean {
  return stateMachineA.getStateIds().every((id) => {
    const stateB = stateMachineB.getState(id);
    return (
      stateB !== undefined &&
      compareStates(stateMachineA.getState(id)!, stateB)
    );
  });
}

function hasSameTransitions(
  stateMachineA: StateMachine,
  stateMachineB: StateMachine,
): boolean {
  return stateMachineA
    .getTransitionIds()
    .every((id) => {
      const transitionB = stateMachineB.getTransition(id);
      return (
        transitionB !== undefined &&
        compareTransitions(
          stateMachineA.getTransition(id)!,
          transitionB,
        )
      );
    });
}

export function compareStateMachines(
  stateMachineA: StateMachine,
  stateMachineB: StateMachine,
): boolean {
  return (
    hasEqualElementCounts(stateMachineA, stateMachineB) &&
    hasSameStates(stateMachineA, stateMachineB) &&
    hasSameTransitions(stateMachineA, stateMachineB)
  );
}
