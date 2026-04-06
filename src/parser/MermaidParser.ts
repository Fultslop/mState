import type { SMStateMachineId, SMStateId, SMTransitionId } from '../types';
import type { IGroupState } from '@src/IGroupState';
import { SMStatus } from '../types';
import type { ISMStateMachine } from '@src/ISMStateMachine';
import { SMValidationException } from '../exceptions';
import { StateMachine } from '../StateMachine';
import { extractTitle, tokenize } from './tokenizer';

const STATUS_MAP: Record<string, SMStatus> = {
  ok:        SMStatus.Ok,
  error:     SMStatus.Error,
  canceled:  SMStatus.Canceled,
  exception: SMStatus.Exception,
  any:       SMStatus.AnyStatus,
};

let _counter = 0;
function nextId(prefix: string): string {
  return `${prefix}#${++_counter}`;
}

export class MermaidParser {
  parse(diagramText: string): ISMStateMachine {
    const title  = extractTitle(diagramText) || nextId('diagram');
    const tokens = tokenize(diagramText);
    const sm     = new StateMachine(title as SMStateMachineId);

    const declared  = new Map<string, 'choice' | 'fork' | 'join'>();
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
        if (tok.to   !== '[*]') members.add(tok.to);
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
      if (type === 'choice') { sm.createChoice(id as SMStateId); return; }
      if (type === 'fork')   { sm.createFork(id as SMStateId);   return; }
      if (type === 'join')   { sm.createJoin(id as SMStateId);   return; }
      if (groupMembers.has(id)) {
        sm.createGroup(id as SMStateId);
        for (const memberId of groupMembers.get(id)!) {
          ensureState(memberId);
          const gs = sm.getState(id as SMStateId);
          const ms = sm.getState(memberId as SMStateId);
          if (gs && ms) (gs as IGroupState).addMember(ms);
        }
        return;
      }
      sm.createState(id as SMStateId);
    };

    const ensureInitial = (context: string | null): string => {
      const key = context ?? '__root__';
      if (initIds.has(key)) return initIds.get(key)!;
      const id = nextId(context ? `${context}_init` : 'init');
      sm.createInitial(id as SMStateId);
      if (context) {
        const gs = sm.getState(context as SMStateId) as IGroupState;
        const is = sm.getState(id as SMStateId)!;
        gs?.addMember(is);
      }
      initIds.set(key, id);
      return id;
    };

    const ensureTerminal = (context: string | null): string => {
      const key = context ?? '__root__';
      if (termIds.has(key)) return termIds.get(key)!;
      const id = nextId(context ? `${context}_term` : 'term');
      sm.createTerminal(id as SMStateId);
      if (context) {
        const gs = sm.getState(context as SMStateId) as IGroupState;
        const ts = sm.getState(id as SMStateId)!;
        gs?.addMember(ts);
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

      const fromId = tok.from === '[*]'
        ? ensureInitial(currentGroup)
        : tok.from;
      const toId   = tok.to === '[*]'
        ? ensureTerminal(currentGroup)
        : tok.to;

      if (tok.from !== '[*]') ensureState(tok.from);
      if (tok.to   !== '[*]') ensureState(tok.to);

      let status: SMStatus | undefined;
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
          throw new SMValidationException(`Malformed transition label '${tok.label}' — at most one '/' allowed`);
        }
        exitCode = parts[1]?.trim() || undefined;
      }

      const tId = nextId('t') as SMTransitionId;
      sm.createTransition(tId, fromId as SMStateId, toId as SMStateId, status, exitCode);
    }

    return sm;
  }
}
