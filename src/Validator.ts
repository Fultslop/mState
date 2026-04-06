import { StateType, StateStatus } from "./IState";
import type { StateId } from './types';
import type { ITransition } from './ITransition';
import type { IState } from './IState';
import type { StateRegistry } from './StateRegistry';
import type { TransitionRegistry } from './TransitionRegistry';
import { SMValidationException } from './exceptions';
import type { GroupState } from './states/GroupState';

export class Validator {
  validate(states: StateRegistry, transitions: TransitionRegistry): void {
    const allStates      = states.all();
    const allTransitions = transitions.all();

    // Only top-level states (not inside any group)
    const groupMemberIds = new Set<StateId>();
    for (const s of allStates) {
      if (s.type === StateType.Group) {
        const g = s as GroupState;
        for (const id of g.memberIds) groupMemberIds.add(id);
      }
    }
    const topLevel = allStates.filter(s => !groupMemberIds.has(s.id));

    // Rule 1: exactly one top-level Initial
    const initials = topLevel.filter(s => s.type === StateType.Initial);
    if (initials.length !== 1) {
      throw new SMValidationException(
        `Rule 1: expected exactly 1 top-level Initial state, found ${initials.length}`
      );
    }

    // Rule 5: all transition endpoints exist
    for (const t of allTransitions) {
      if (!states.get(t.fromStateId)) {
        throw new SMValidationException(`Rule 5: transition '${t.id}' fromStateId '${t.fromStateId}' not found`);
      }
      if (!states.get(t.toStateId)) {
        throw new SMValidationException(`Rule 5: transition '${t.id}' toStateId '${t.toStateId}' not found`);
      }
    }

    // Rule 16: AnyStatus cannot be combined with exitCode
    for (const t of allTransitions) {
      if (t.status === StateStatus.AnyStatus && t.exitCode !== undefined) {
        throw new SMValidationException(
          `Rule 16: transition '${t.id}' uses AnyStatus with exitCode '${t.exitCode}' — not allowed`
        );
      }
    }

    // Rules 2 & 3: reachability from initial (BFS)
    const initial = initials[0]!;
    const reachable = this._reachable(initial.id, states, transitions);

    const hasTerminal = allStates.some(
      s => s.type === StateType.Terminal && reachable.has(s.id)
    );
    if (!hasTerminal) {
      throw new SMValidationException('Rule 2: no Terminal state is reachable from Initial');
    }

    for (const s of topLevel) {
      if (s.type === StateType.Initial) continue;
      if (!reachable.has(s.id)) {
        throw new SMValidationException(`Rule 3: state '${s.id}' is not reachable from Initial`);
      }
    }

    // Rule 7 & 8: Choice validation
    for (const s of allStates) {
      if (s.type !== StateType.Choice) continue;
      if (s.outgoing.size === 0) {
        throw new SMValidationException(`Rule 7: Choice '${s.id}' has no outgoing transitions`);
      }
      const outgoing = Array.from(s.outgoing)
        .map(id => transitions.get(id))
        .filter((t): t is ITransition => t !== undefined);
      const seen = new Set<string>();
      let defaultCount = 0;
      for (const t of outgoing) {
        if (t.status === undefined || t.status === StateStatus.AnyStatus) {
          if (t.exitCode === undefined) defaultCount++;
        }
        const key = `${t.status ?? ''}/${t.exitCode ?? ''}`;
        if (seen.has(key)) {
          throw new SMValidationException(
            `Rule 8: Choice '${s.id}' has duplicate outgoing transition for (${t.status}, ${t.exitCode})`
          );
        }
        seen.add(key);
      }
      if (defaultCount > 1) {
        throw new SMValidationException(`Rule 9: Choice '${s.id}' has more than one default transition`);
      }
    }

    // Rule 10: Fork branches must reach a Join before Terminal
    for (const s of allStates) {
      if (s.type !== StateType.Fork) continue;
      for (const branchTId of s.outgoing) {
        const t = transitions.get(branchTId);
        if (!t) continue;
        if (!this._reachesJoinBeforeTerminal(t.toStateId, states, transitions)) {
          throw new SMValidationException(
            `Rule 10: Fork '${s.id}' branch '${t.toStateId}' reaches Terminal without going through a Join`
          );
        }
      }
    }

    // Rule 11: Join must not be directly followed by Choice
    for (const s of allStates) {
      if (s.type !== StateType.Join) continue;
      for (const outId of s.outgoing) {
        const t = transitions.get(outId);
        if (!t) continue;
        const target = states.get(t.toStateId);
        if (target?.type === StateType.Choice) {
          throw new SMValidationException(
            `Rule 11: Join '${s.id}' is directly followed by Choice '${target.id}'`
          );
        }
      }
    }

    // Rules 13-15: Group validation
    for (const s of allStates) {
      if (s.type !== StateType.Group) continue;
      const g = s as GroupState;
      const members = Array.from(g.memberIds).map(id => states.get(id)).filter((m): m is IState => m !== undefined);
      const groupInitials = members.filter(m => m.type === StateType.Initial);
      if (groupInitials.length !== 1) {
        throw new SMValidationException(
          `Rule 13: Group '${g.id}' must have exactly 1 Internal Initial, found ${groupInitials.length}`
        );
      }
      const groupInitial = groupInitials[0]!;
      const groupReachable = this._reachableWithin(groupInitial.id, g.memberIds, states, transitions);
      const hasGroupTerminal = members.some(m => m.type === StateType.Terminal && groupReachable.has(m.id));
      if (!hasGroupTerminal) {
        throw new SMValidationException(`Rule 14: Group '${g.id}' has no reachable Terminal from its internal Initial`);
      }

      // Rule 15: no cross-boundary transitions
      for (const t of allTransitions) {
        const fromInGroup = g.hasMember(t.fromStateId);
        const toInGroup   = g.hasMember(t.toStateId);
        if (fromInGroup !== toInGroup) {
          const fromIsGroup = t.fromStateId === g.id;
          const toIsGroup   = t.toStateId === g.id;
          if (!fromIsGroup && !toIsGroup) {
            throw new SMValidationException(
              `Rule 15: transition '${t.id}' crosses Group '${g.id}' boundary`
            );
          }
        }
      }
    }
  }

  private _reachable(
    startId: StateId,
    states: StateRegistry,
    transitions: TransitionRegistry,
  ): Set<StateId> {
    const visited = new Set<StateId>();
    const queue   = [startId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const s = states.get(id);
      if (!s) continue;
      for (const tId of s.outgoing) {
        const t = transitions.get(tId);
        if (t && !visited.has(t.toStateId)) queue.push(t.toStateId);
      }
    }
    return visited;
  }

  private _reachableWithin(
    startId: StateId,
    allowed: Set<StateId>,
    states: StateRegistry,
    transitions: TransitionRegistry,
  ): Set<StateId> {
    const visited = new Set<StateId>();
    const queue   = [startId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id) || !allowed.has(id)) continue;
      visited.add(id);
      const s = states.get(id);
      if (!s) continue;
      for (const tId of s.outgoing) {
        const t = transitions.get(tId);
        if (t && !visited.has(t.toStateId)) queue.push(t.toStateId);
      }
    }
    return visited;
  }

  private _reachesJoinBeforeTerminal(
    startId: StateId,
    states: StateRegistry,
    transitions: TransitionRegistry,
  ): boolean {
    const visited = new Set<StateId>();
    const queue   = [startId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const s = states.get(id);
      if (!s) continue;
      if (s.type === StateType.Join) return true;
      if (s.type === StateType.Terminal) return false;
      for (const tId of s.outgoing) {
        const t = transitions.get(tId);
        if (t) queue.push(t.toStateId);
      }
    }
    return false;
  }
}
