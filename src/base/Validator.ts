import { StateType, StateStatus } from '../model/State';
import type { StateId } from '../model/types';
import type { Transition } from '../model/Transition';
import type { State } from '../model/State';
import type { StateRegistry } from './StateRegistry';
import type { TransitionRegistry } from './TransitionRegistry';
import { SMValidationException } from './SMValidationException';
import { requiresTruthy } from '../common/requires';
import type { GroupState } from '../model/GroupState';
import type { ParallelState } from './ParallelState';
import type { Region } from './Region';

// ── BFS helpers ──────────────────────────────────────────────────────────────

function bfsReachable(
  startId: StateId,
  stateReg: StateRegistry,
  transReg: TransitionRegistry,
): Set<StateId> {
  const visited = new Set<StateId>();
  const queue = [startId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (!visited.has(id)) {
      visited.add(id);
      const state = stateReg.get(id);
      requiresTruthy(
        state,
        `state '${id}' not found in bfsReachable`,
      );
      for (const transId of state.outgoing) {
        const transition = transReg.get(transId);
        if (
          transition &&
          !visited.has(transition.toStateId)
        ) {
          queue.push(transition.toStateId);
        }
      }
    }
  }
  return visited;
}

function bfsReachableWithin(
  startId: StateId,
  allowed: Set<StateId>,
  stateReg: StateRegistry,
  transReg: TransitionRegistry,
): Set<StateId> {
  const visited = new Set<StateId>();
  const queue = [startId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (!visited.has(id) && allowed.has(id)) {
      visited.add(id);
      const state = stateReg.get(id);
      requiresTruthy(
        state,
        `state '${id}' not found in bfsReachableWithin`,
      );
      for (const transId of state.outgoing) {
        const transition = transReg.get(transId);
        if (
          transition &&
          !visited.has(transition.toStateId)
        ) {
          queue.push(transition.toStateId);
        }
      }
    }
  }
  return visited;
}

function bfsReachesJoinBeforeTerminal(
  startId: StateId,
  stateReg: StateRegistry,
  transReg: TransitionRegistry,
): boolean {
  const visited = new Set<StateId>();
  const queue = [startId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (!visited.has(id)) {
      visited.add(id);
      const state = stateReg.get(id);
      requiresTruthy(
        state,
        `state '${id}' not found in bfsReachesJoinBeforeTerminal`,
      );
      if (state.type === StateType.Join) {
        return true;
      }
      if (state.type === StateType.Terminal) {
        return false;
      }
      for (const transId of state.outgoing) {
        const transition = transReg.get(transId);
        if (transition) {
          queue.push(transition.toStateId);
        }
      }
    }
  }
  return false;
}

// ── Rule validators ──────────────────────────────────────────────────────────

function buildTopLevel(allStates: readonly State[]): State[] {
  const groupMemberIds = new Set<StateId>();
  for (const iterState of allStates) {
    if (iterState.type === StateType.Group) {
      for (const id of (iterState as GroupState)
        .stateIds) {
        groupMemberIds.add(id);
      }
    }
    if (iterState.type === StateType.Parallel) {
      const parallel = iterState as ParallelState;
      for (const region of parallel.getRegions()) {
        for (const id of region.stateIds) {
          groupMemberIds.add(id);
        }
      }
    }
  }
  return allStates.filter(
    (state) => !groupMemberIds.has(state.id),
  );
}

function validateRule1(topLevel: readonly State[]): State {
  const initials = topLevel.filter(
    (iterState) =>
      iterState.type === StateType.Initial,
  );
  if (initials.length !== 1) {
    throw new SMValidationException(
      `Rule 1: expected exactly 1 top-level Initial state, ` +
        `found ${initials.length}`,
    );
  }
  return initials[0]!;
}

function validateRule5(
  allTransitions: readonly Transition[],
  states: StateRegistry,
): void {
  for (const transition of allTransitions) {
    if (!states.get(transition.fromStateId)) {
      throw new SMValidationException(
        `Rule 5: transition '${transition.id}' ` +
          `fromStateId '${transition.fromStateId}' ` +
          'not found',
      );
    }
    if (!states.get(transition.toStateId)) {
      throw new SMValidationException(
        `Rule 5: transition '${transition.id}' ` +
          `toStateId '${transition.toStateId}' ` +
          'not found',
      );
    }
  }
}

function validateRule16(
  allTransitions: readonly Transition[],
): void {
  for (const transition of allTransitions) {
    if (
      transition.status === StateStatus.AnyStatus &&
      transition.exitCode !== undefined
    ) {
      throw new SMValidationException(
        `Rule 16: transition '${transition.id}' uses ` +
          `AnyStatus with exitCode '${transition.exitCode}' ` +
          '— not allowed',
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
  const reachable = bfsReachable(
    initial.id,
    states,
    transitions,
  );

  const terminalReachable = topLevel.some(
    (iterState) =>
      iterState.type === StateType.Terminal &&
      reachable.has(iterState.id),
  );
  if (!terminalReachable) {
    throw new SMValidationException(
      'Rule 2: no Terminal state is reachable from Initial',
    );
  }

  for (const iterState of topLevel.filter(
    (state) => state.type !== StateType.Initial,
  )) {
    if (!reachable.has(iterState.id)) {
      throw new SMValidationException(
        `Rule 3: state '${iterState.id}' is not ` +
          'reachable from Initial',
      );
    }
  }
}

function validateChoiceTransitions(
  stateId: StateId,
  outgoing: readonly Transition[],
): void {
  const seen = new Set<string>();
  let defaultCount = 0;
  for (const transition of outgoing) {
    if (
      transition.status === undefined ||
      transition.status === StateStatus.AnyStatus
    ) {
      if (transition.exitCode === undefined) {
        defaultCount++;
      }
    }
    const statusPart = transition.status ?? '';
    const exitPart = transition.exitCode ?? '';
    const key = `${statusPart}/${exitPart}`;
    if (seen.has(key)) {
      throw new SMValidationException(
        `Rule 8: Choice '${stateId}' has duplicate ` +
          `outgoing transition for (${transition.status}, ` +
          `${transition.exitCode})`,
      );
    }
    seen.add(key);
  }
  if (defaultCount > 1) {
    throw new SMValidationException(
      `Rule 9: Choice '${stateId}' has more than one ` +
        'default transition',
    );
  }
}

function validateChoices(
  allStates: readonly State[],
  transitions: TransitionRegistry,
): void {
  for (const iterState of allStates.filter(
    (state) => state.type === StateType.Choice,
  )) {
    if (iterState.outgoing.size === 0) {
      throw new SMValidationException(
        `Rule 7: Choice '${iterState.id}' has no ` +
          'outgoing transitions',
      );
    }
    const outgoing = Array.from(iterState.outgoing)
      .map((id) => transitions.get(id))
      .filter(
        (trans): trans is Transition => trans !== undefined,
      );
    validateChoiceTransitions(iterState.id, outgoing);
  }
}

function validateForks(
  allStates: readonly State[],
  states: StateRegistry,
  transitions: TransitionRegistry,
): void {
  for (const iterState of allStates.filter(
    (state) => state.type === StateType.Fork,
  )) {
    for (const branchTId of iterState.outgoing) {
      const transition = transitions.get(branchTId);
      requiresTruthy(
        transition,
        `transition '${branchTId}' not found (Rule 10)`,
      );
      if (
        !bfsReachesJoinBeforeTerminal(
          transition.toStateId,
          states,
          transitions,
        )
      ) {
        throw new SMValidationException(
          `Rule 10: Fork '${iterState.id}' branch ` +
            `'${transition.toStateId}' reaches Terminal ` +
            'without going through a Join',
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
  for (const iterState of allStates.filter(
    (state) => state.type === StateType.Join,
  )) {
    for (const outId of iterState.outgoing) {
      const transition = transitions.get(outId);
      requiresTruthy(
        transition,
        `transition '${outId}' not found (Rule 11)`,
      );
      const target = states.get(transition.toStateId);
      if (target?.type === StateType.Choice) {
        throw new SMValidationException(
          `Rule 11: Join '${iterState.id}' is directly ` +
            `followed by Choice '${target.id}'`,
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
  for (const iterState of allStates.filter(
    (state) => state.type === StateType.Group,
  )) {
    const group = iterState as GroupState;
    const members = Array.from(group.stateIds)
      .map((id) => states.get(id))
      .filter(
        (member): member is State => member !== undefined,
      );
    const groupInitials = members.filter(
      (member) => member.type === StateType.Initial,
    );
    if (groupInitials.length !== 1) {
      throw new SMValidationException(
        `Rule 13: Group '${group.id}' must have exactly 1 ` +
          `Internal Initial, found ${groupInitials.length}`,
      );
    }
    const groupReachable = bfsReachableWithin(
      groupInitials[0]!.id,
      group.stateIds,
      states,
      transitions,
    );
    const terminalReachable = members.some(
      (member) =>
        member.type === StateType.Terminal &&
        groupReachable.has(member.id),
    );
    if (!terminalReachable) {
      throw new SMValidationException(
        `Rule 14: Group '${group.id}' has no reachable ` +
          'Terminal from its internal Initial',
      );
    }
    for (const transition of allTransitions) {
      const fromInGroup = group.hasState(
        transition.fromStateId,
      );
      const toInGroup = group.hasState(transition.toStateId);
      if (
        fromInGroup !== toInGroup &&
        transition.fromStateId !== group.id &&
        transition.toStateId !== group.id
      ) {
        throw new SMValidationException(
          `Rule 15: transition '${transition.id}' crosses ` +
            `Group '${group.id}' boundary`,
        );
      }
    }
  }
}

// ── Parallel validation helpers ──────────────────────────────────────────────

function validateNoCrossRegionTransitions(
  region: Region,
  parallel: ParallelState,
  allTransitions: readonly Transition[],
): void {
  for (const transId of region.transitionIds) {
    const transition = allTransitions.find(
      (transitionRef) =>
        transitionRef.id === transId,
    );
    if (transition) {
      const fromInRegion = region.hasState(
        transition.fromStateId,
      );
      const toInRegion = region.hasState(
        transition.toStateId,
      );
      if (
        fromInRegion &&
        !toInRegion &&
        transition.toStateId !== region.terminal.id
      ) {
        for (const other of parallel.getRegions()) {
          if (
            other !== region &&
            other.hasState(transition.toStateId)
          ) {
            throw new SMValidationException(
              `P3: transition '${transition.id}' crosses ` +
                'region boundary between ' +
                `'${region.id}' and '${other.id}'`,
            );
          }
        }
      }
    }
  }
}

function validateNoOuterTerminalBypass(
  region: Region,
  parallel: ParallelState,
  allTransitions: readonly Transition[],
  allStates: readonly State[],
  states: StateRegistry,
): void {
  const outerTerminalIds = new Set<StateId>(
    allStates
      .filter(
        (iterState) =>
          iterState.type === StateType.Terminal &&
          !parallel.findRegionForState(iterState.id),
      )
      .map((iterState) => iterState.id),
  );
  for (const stateId of region.stateIds) {
    const state = states.get(stateId);
    if (state) {
      for (const transId of state.outgoing) {
        const transition = allTransitions.find(
          (transitionRef) =>
            transitionRef.id === transId,
        );
        if (
          transition &&
          outerTerminalIds.has(transition.toStateId)
        ) {
          throw new SMValidationException(
            `P5: state '${stateId}' in region ` +
              `'${region.id}' transitions directly to ` +
              `outer terminal '${transition.toStateId}' ` +
              '— must go through region terminal',
          );
        }
      }
    }
  }
}

function validateParallelRegion(
  region: Region,
  parallel: ParallelState,
  allTransitions: readonly Transition[],
  allStates: readonly State[],
  states: StateRegistry,
): void {
  const initials = Array.from(region.stateIds).filter(
    (id) => states.get(id)?.type === StateType.Initial,
  );
  if (initials.length !== 1) {
    throw new SMValidationException(
      `P1: Region '${region.id}' in parallel ` +
        `'${parallel.id}' must have exactly 1 Initial ` +
        `state, found ${initials.length}`,
    );
  }

  if (!states.get(region.terminal.id)) {
    throw new SMValidationException(
      `P2: Region '${region.id}' in parallel ` +
        `'${parallel.id}' is missing its terminal state`,
    );
  }

  validateNoCrossRegionTransitions(
    region,
    parallel,
    allTransitions,
  );
  validateNoOuterTerminalBypass(
    region,
    parallel,
    allTransitions,
    allStates,
    states,
  );
}

function validateParallels(
  allStatesList: readonly State[],
  allTransitions: readonly Transition[],
  states: StateRegistry,
): void {
  for (const iterState of allStatesList.filter(
    (state) => state.type === StateType.Parallel,
  )) {
    const parallel = iterState as ParallelState;

    for (const region of parallel.getRegions()) {
      validateParallelRegion(
        region,
        parallel,
        allTransitions,
        allStatesList,
        states,
      );
    }

    for (const transId of parallel.outgoing) {
      const transition = allTransitions.find(
        (transitionRef) =>
          transitionRef.id === transId,
      );
      if (
        transition &&
        states.get(transition.toStateId)?.type ===
          StateType.Choice
      ) {
        throw new SMValidationException(
          `P4: Parallel '${parallel.id}' is directly ` +
            `followed by Choice '${transition.toStateId}' ` +
            'without an intervening state',
        );
      }
    }
  }
}

// ── Entry point ──────────────────────────────────────────────────────────────

export function validateStateMachine(
  states: StateRegistry,
  transitions: TransitionRegistry,
): void {
  const allStatesList = states.all();
  const allTransitions = transitions.all();
  const topLevel = buildTopLevel(allStatesList);
  const initial = validateRule1(topLevel);
  validateRule5(allTransitions, states);
  validateRule16(allTransitions);
  validateReachability(
    initial,
    topLevel,
    states,
    transitions,
  );
  validateChoices(allStatesList, transitions);
  validateForks(allStatesList, states, transitions);
  validateJoins(allStatesList, states, transitions);
  validateGroups(
    allStatesList,
    allTransitions,
    states,
    transitions,
  );
  validateParallels(
    allStatesList,
    allTransitions,
    states,
  );
}
