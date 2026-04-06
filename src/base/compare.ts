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

function sortKeys(obj: unknown): unknown {
  let result: unknown = obj;

  const isObject =
    obj !== null &&
    typeof obj === TYPE_OBJECT &&
    !Array.isArray(obj);
  if (isObject) {
    result = Object.fromEntries(
      Object.entries(obj as Record<string, unknown>)
        .sort(
          ([keyA], [keyB]) => keyA.localeCompare(keyB),
        )
        .map(([key, value]) => [key, sortKeys(value)]),
    );
  }
  return result;
}

function deepEqual(
  valueA: unknown,
  valueB: unknown,
): boolean {
  let result = false;
  if (valueA === valueB) {
    result = true;
  } else if (
    valueA !== undefined &&
    valueB !== undefined &&
    valueA !== null &&
    valueB !== null
  ) {
    result =
      JSON.stringify(sortKeys(valueA)) ===
      JSON.stringify(sortKeys(valueB));
  }
  return result;
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
  const aMatchesB = stateMachineA.getStateIds().every((id) => {
    const stateB = stateMachineB.getState(id);
    return (
      stateB !== undefined &&
      compareStates(stateMachineA.getState(id)!, stateB)
    );
  });
  const bMatchesA = stateMachineB.getStateIds().every((id) =>
    stateMachineA.getState(id) !== undefined,
  );
  return aMatchesB && bMatchesA;
}

function hasSameTransitions(
  stateMachineA: StateMachine,
  stateMachineB: StateMachine,
): boolean {
  const aMatchesB = stateMachineA
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
  const bMatchesA = stateMachineB
    .getTransitionIds()
    .every((id) =>
      stateMachineA.getTransition(id) !== undefined,
    );
  return aMatchesB && bMatchesA;
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
