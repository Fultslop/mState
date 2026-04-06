import { StateType, StateStatus } from '../model/State';
import type { StateId } from '../model/types';
import type { Transition } from '../model/Transition';
import type { State } from '../model/State';
import type { StateRegistry } from './StateRegistry';
import type { TransitionRegistry } from './TransitionRegistry';
import { SMValidationException } from './SMValidationException';
import { requiresTruthy } from '../common/requires';
import type { GroupState } from '../model/GroupState';

// ── BFS helpers ───────────────────────────────────────────────────────────────

function bfsReachable(
  startId: StateId,
  states: StateRegistry,
  transitions: TransitionRegistry,
): Set<StateId> {
  const visited = new Set<StateId>();
  const queue = [startId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (!visited.has(id)) {
      visited.add(id);
      const s = states.get(id);
      requiresTruthy(s, `state '${id}' not found in bfsReachable`);
      for (const tId of s.outgoing) {
        const t = transitions.get(tId);
        if (t && !visited.has(t.toStateId)) queue.push(t.toStateId);
      }
    }
  }
  return visited;
}

function bfsReachableWithin(
  startId: StateId,
  allowed: Set<StateId>,
  states: StateRegistry,
  transitions: TransitionRegistry,
): Set<StateId> {
  const visited = new Set<StateId>();
  const queue = [startId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (!visited.has(id) && allowed.has(id)) {
      visited.add(id);
      const s = states.get(id);
      requiresTruthy(s, `state '${id}' not found in bfsReachableWithin`);
      for (const tId of s.outgoing) {
        const t = transitions.get(tId);
        if (t && !visited.has(t.toStateId)) queue.push(t.toStateId);
      }
    }
  }
  return visited;
}

function bfsReachesJoinBeforeTerminal(
  startId: StateId,
  states: StateRegistry,
  transitions: TransitionRegistry,
): boolean {
  const visited = new Set<StateId>();
  const queue = [startId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (!visited.has(id)) {
      visited.add(id);
      const s = states.get(id);
      requiresTruthy(s, `state '${id}' not found in bfsReachesJoinBeforeTerminal`);
      if (s.type === StateType.Join) return true;
      if (s.type === StateType.Terminal) return false;
      for (const tId of s.outgoing) {
        const t = transitions.get(tId);
        if (t) queue.push(t.toStateId);
      }
    }
  }
  return false;
}

// ── Rule validators ───────────────────────────────────────────────────────────

function buildTopLevel(allStates: readonly State[]): State[] {
  const groupMemberIds = new Set<StateId>();
  for (const s of allStates) {
    if (s.type === StateType.Group) {
      for (const id of (s as GroupState).stateIds) groupMemberIds.add(id);
    }
  }
  return allStates.filter((state) => !groupMemberIds.has(state.id));
}

function validateRule1(topLevel: readonly State[]): State {
  const initials = topLevel.filter((state) => state.type === StateType.Initial);
  if (initials.length !== 1) {
    throw new SMValidationException(
      `Rule 1: expected exactly 1 top-level Initial state, found ${initials.length}`,
    );
  }
  return initials[0]!;
}

function validateRule5(allTransitions: readonly Transition[], states: StateRegistry): void {
  for (const t of allTransitions) {
    if (!states.get(t.fromStateId)) {
      throw new SMValidationException(
        `Rule 5: transition '${t.id}' fromStateId '${t.fromStateId}' not found`,
      );
    }
    if (!states.get(t.toStateId)) {
      throw new SMValidationException(
        `Rule 5: transition '${t.id}' toStateId '${t.toStateId}' not found`,
      );
    }
  }
}

function validateRule16(allTransitions: readonly Transition[]): void {
  for (const t of allTransitions) {
    if (t.status === StateStatus.AnyStatus && t.exitCode !== undefined) {
      throw new SMValidationException(
        `Rule 16: transition '${t.id}' uses AnyStatus with exitCode '${t.exitCode}' — not allowed`,
      );
    }
  }
}

function validateReachability(
  initial: State,
  topLevel: readonly State[],
  states: StateRegistry,
  transitions: TransitionRegistry,
): void {
  const reachable = bfsReachable(initial.id, states, transitions);

  if (!topLevel.some((state) => state.type === StateType.Terminal && reachable.has(state.id))) {
    throw new SMValidationException('Rule 2: no Terminal state is reachable from Initial');
  }

  for (const s of topLevel.filter((state) => state.type !== StateType.Initial)) {
    if (!reachable.has(s.id)) {
      throw new SMValidationException(`Rule 3: state '${s.id}' is not reachable from Initial`);
    }
  }
}

function validateChoiceTransitions(stateId: StateId, outgoing: readonly Transition[]): void {
  const seen = new Set<string>();
  let defaultCount = 0;
  for (const t of outgoing) {
    if (t.status === undefined || t.status === StateStatus.AnyStatus) {
      if (t.exitCode === undefined) defaultCount++;
    }
    const key = `${t.status ?? ''}/${t.exitCode ?? ''}`;
    if (seen.has(key)) {
      throw new SMValidationException(
        `Rule 8: Choice '${stateId}' has duplicate outgoing transition for (${t.status}, ${t.exitCode})`,
      );
    }
    seen.add(key);
  }
  if (defaultCount > 1) {
    throw new SMValidationException(
      `Rule 9: Choice '${stateId}' has more than one default transition`,
    );
  }
}

function validateChoices(allStates: readonly State[], transitions: TransitionRegistry): void {
  for (const s of allStates.filter((state) => state.type === StateType.Choice)) {
    if (s.outgoing.size === 0) {
      throw new SMValidationException(`Rule 7: Choice '${s.id}' has no outgoing transitions`);
    }
    const outgoing = Array.from(s.outgoing)
      .map((id) => transitions.get(id))
      .filter((t): t is Transition => t !== undefined);
    validateChoiceTransitions(s.id, outgoing);
  }
}

function validateForks(
  allStates: readonly State[],
  states: StateRegistry,
  transitions: TransitionRegistry,
): void {
  for (const s of allStates.filter((state) => state.type === StateType.Fork)) {
    for (const branchTId of s.outgoing) {
      const t = transitions.get(branchTId);
      requiresTruthy(t, `transition '${branchTId}' not found (Rule 10)`);
      if (!bfsReachesJoinBeforeTerminal(t.toStateId, states, transitions)) {
        throw new SMValidationException(
          `Rule 10: Fork '${s.id}' branch '${t.toStateId}' reaches Terminal without going through a Join`,
        );
      }
    }
  }
}

function validateJoins(
  allStates: readonly State[],
  states: StateRegistry,
  transitions: TransitionRegistry,
): void {
  for (const s of allStates.filter((state) => state.type === StateType.Join)) {
    for (const outId of s.outgoing) {
      const t = transitions.get(outId);
      requiresTruthy(t, `transition '${outId}' not found (Rule 11)`);
      const target = states.get(t.toStateId);
      if (target?.type === StateType.Choice) {
        throw new SMValidationException(
          `Rule 11: Join '${s.id}' is directly followed by Choice '${target.id}'`,
        );
      }
    }
  }
}

function validateGroups(
  allStates: readonly State[],
  allTransitions: readonly Transition[],
  states: StateRegistry,
  transitions: TransitionRegistry,
): void {
  for (const s of allStates.filter((state) => state.type === StateType.Group)) {
    const g = s as GroupState;
    const members = Array.from(g.stateIds)
      .map((id) => states.get(id))
      .filter((m): m is State => m !== undefined);
    const groupInitials = members.filter((m) => m.type === StateType.Initial);
    if (groupInitials.length !== 1) {
      throw new SMValidationException(
        `Rule 13: Group '${g.id}' must have exactly 1 Internal Initial, found ${groupInitials.length}`,
      );
    }
    const groupReachable = bfsReachableWithin(groupInitials[0]!.id, g.stateIds, states, transitions);
    if (!members.some((m) => m.type === StateType.Terminal && groupReachable.has(m.id))) {
      throw new SMValidationException(
        `Rule 14: Group '${g.id}' has no reachable Terminal from its internal Initial`,
      );
    }
    for (const t of allTransitions) {
      const fromInGroup = g.hasState(t.fromStateId);
      const toInGroup = g.hasState(t.toStateId);
      if (fromInGroup !== toInGroup && t.fromStateId !== g.id && t.toStateId !== g.id) {
        throw new SMValidationException(
          `Rule 15: transition '${t.id}' crosses Group '${g.id}' boundary`,
        );
      }
    }
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

export function validateStateMachine(states: StateRegistry, transitions: TransitionRegistry): void {
  const allStates = states.all();
  const allTransitions = transitions.all();
  const topLevel = buildTopLevel(allStates);
  const initial = validateRule1(topLevel);
  validateRule5(allTransitions, states);
  validateRule16(allTransitions);
  validateReachability(initial, topLevel, states, transitions);
  validateChoices(allStates, transitions);
  validateForks(allStates, states, transitions);
  validateJoins(allStates, states, transitions);
  validateGroups(allStates, allTransitions, states, transitions);
}
