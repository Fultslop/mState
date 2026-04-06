import type { StateMachineId, StateId, TransitionId } from '../types';
import type { IGroupState } from '@src/IGroupState';
import { StateStatus } from '@src/IState';
import type { IStateMachine } from '@src/IStateMachine';
import { SMValidationException } from '../exceptions';
import { BasicStateMachine } from '../BasicStateMachine';
import { extractTitle, tokenize } from './tokenizer';
import { StateMachineBuilder } from '@src/StateMachineBuilder';

const STATUS_MAP: Record<string, StateStatus> = {
  ok: StateStatus.Ok,
  error: StateStatus.Error,
  canceled: StateStatus.Canceled,
  exception: StateStatus.Exception,
  any: StateStatus.AnyStatus,
};

let _counter = 0;
function nextId(prefix: string): string {
  return `${prefix}#${++_counter}`;
}

export class MermaidParser {
  parse(diagramText: string): IStateMachine {
    const title = extractTitle(diagramText) || nextId('diagram');
    const tokens = tokenize(diagramText);
    const sm = new BasicStateMachine(title as StateMachineId);
    const builder = new StateMachineBuilder(sm);

    const declared = new Map<string, 'choice' | 'fork' | 'join'>();
    const groupStack: string[] = [];
    const groupMembers = new Map<string, Set<string>>();

    // ── Pass 1: collect state declarations and group membership ──────────────
    let depth = 0;
    let currentGroup: string | null = null;

    for (const tok of tokens) {
      if (tok.kind === 'stateDecl') {
        declared.set(tok.id, tok.stateType);
      } else if (tok.kind === 'groupOpen') {
        if (depth === 0) currentGroup = tok.id;
        if (currentGroup && !groupMembers.has(currentGroup)) {
          groupMembers.set(currentGroup, new Set());
        }
        groupStack.push(tok.id);
        depth++;
      } else if (tok.kind === 'groupClose') {
        groupStack.pop();
        depth--;
        if (depth === 0) currentGroup = null;
      } else if (tok.kind === 'transition' && currentGroup !== null) {
        const members = groupMembers.get(currentGroup)!;
        if (tok.from !== '[*]') members.add(tok.from);
        if (tok.to !== '[*]') members.add(tok.to);
      }
    }

    // ── Helper: ensure a state is created (idempotent) ───────────────────────
    const ensured = new Set<string>();
    const initIds = new Map<string, string>();
    const termIds = new Map<string, string>();

    const ensureState = (id: string): void => {
      if (ensured.has(id)) return;
      ensured.add(id);
      const type = declared.get(id);
      if (type === 'choice') {
        builder.createChoice(id as StateId);
        return;
      }
      if (type === 'fork') {
        builder.createFork(id as StateId);
        return;
      }
      if (type === 'join') {
        builder.createJoin(id as StateId);
        return;
      }
      if (groupMembers.has(id)) {
        builder.createGroup(id as StateId);
        for (const memberId of groupMembers.get(id)!) {
          ensureState(memberId);
          const gs = sm.getState(id as StateId);
          const ms = sm.getState(memberId as StateId);
          if (gs && ms) (gs as IGroupState).addState(ms);
        }
        return;
      }
      builder.createState(id as StateId);
    };

    const ensureInitial = (context: string | null): string => {
      const key = context ?? '__root__';
      if (initIds.has(key)) return initIds.get(key)!;
      const id = nextId(context ? `${context}_init` : 'init');
      builder.createInitial(id as StateId);
      if (context) {
        const gs = sm.getState(context as StateId) as IGroupState;
        const is = sm.getState(id as StateId)!;
        gs?.addState(is);
      }
      initIds.set(key, id);
      return id;
    };

    const ensureTerminal = (context: string | null): string => {
      const key = context ?? '__root__';
      if (termIds.has(key)) return termIds.get(key)!;
      const id = nextId(context ? `${context}_term` : 'term');
      builder.createTerminal(id as StateId);
      if (context) {
        const gs = sm.getState(context as StateId) as IGroupState;
        const ts = sm.getState(id as StateId)!;
        gs?.addState(ts);
      }
      termIds.set(key, id);
      return id;
    };

    // ── Pass 2: build transitions ─────────────────────────────────────────────
    depth = 0;
    currentGroup = null;
    const groupDepthStack: (string | null)[] = [];

    for (const tok of tokens) {
      if (tok.kind === 'groupOpen') {
        groupDepthStack.push(currentGroup);
        currentGroup = tok.id;
        ensureState(tok.id);
        depth++;
        continue;
      }
      if (tok.kind === 'groupClose') {
        currentGroup = groupDepthStack.pop() ?? null;
        depth--;
        continue;
      }
      if (tok.kind !== 'transition') continue;

      const fromId = tok.from === '[*]' ? ensureInitial(currentGroup) : tok.from;
      const toId = tok.to === '[*]' ? ensureTerminal(currentGroup) : tok.to;

      if (tok.from !== '[*]') ensureState(tok.from);
      if (tok.to !== '[*]') ensureState(tok.to);

      let status: StateStatus | undefined;
      let exitCode: string | undefined;

      if (tok.label) {
        const parts = tok.label.split('/');
        const rawStatus = parts[0]?.trim().toLowerCase();
        if (rawStatus) {
          status = STATUS_MAP[rawStatus];
          if (status === undefined) {
            throw new SMValidationException(`Unknown status label '${parts[0]}' in transition`);
          }
        }
        if (parts.length > 2) {
          throw new SMValidationException(
            `Malformed transition label '${tok.label}' — at most one '/' allowed`,
          );
        }
        exitCode = parts[1]?.trim() || undefined;
      }

      const tId = nextId('t') as TransitionId;
      builder.createTransition(tId, fromId as StateId, toId as StateId, status, exitCode);
    }

    return sm;
  }
}
