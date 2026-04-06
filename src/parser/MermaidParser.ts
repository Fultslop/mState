import { randomUUID } from 'crypto';
import type { StateMachineId, StateId, TransitionId } from '../model/types';
import type { GroupState } from '@src/model/GroupState';
import { StateStatus } from '@src/model/State';
import type { StateMachine } from '@src/model/StateMachine';
import { SMValidationException } from '@src/base/SMValidationException';
import { BasicStateMachine } from '../base/BasicStateMachine';
import { extractTitle, tokenize, type Token } from './tokenizer';
import { StateMachineBuilder } from '@src/base/StateMachineBuilder';

const STATUS_MAP: Record<string, StateStatus> = {
  ok: StateStatus.Ok,
  error: StateStatus.Error,
  canceled: StateStatus.Canceled,
  exception: StateStatus.Exception,
  any: StateStatus.AnyStatus,
};

interface CollectResult {
  declared: Map<string, 'choice' | 'fork' | 'join'>;
  groupMembers: Map<string, Set<string>>;
}

interface BuildContext {
  sm: BasicStateMachine;
  builder: StateMachineBuilder;
  declared: Map<string, 'choice' | 'fork' | 'join'>;
  groupMembers: Map<string, Set<string>>;
  ensured: Set<string>;
  initIds: Map<string, string>;
  termIds: Map<string, string>;
}

interface LabelResult {
  status: StateStatus | undefined;
  exitCode: string | undefined;
}

// ── Pass 1 helpers ───────────────────────────────────────────────────────────

function handleGroupOpen(
  tok: Extract<Token, { kind: 'groupOpen' }>,
  groupMembers: Map<string, Set<string>>,
  groupStack: string[],
  state: { depth: number; currentGroup: string | null },
): void {
  if (state.depth === 0) state.currentGroup = tok.id;
  if (state.currentGroup) {
    groupMembers.set(state.currentGroup, groupMembers.get(state.currentGroup) ?? new Set());
  }
  groupStack.push(tok.id);
  state.depth += 1;
}

function handleGroupClose(
  groupStack: string[],
  state: { depth: number; currentGroup: string | null },
): void {
  groupStack.pop();
  state.depth -= 1;
  if (state.depth === 0) state.currentGroup = null;
}

function handleTransitionDecl(
  tok: Extract<Token, { kind: 'transition' }>,
  groupMembers: Map<string, Set<string>>,
  currentGroup: string | null,
): void {
  if (currentGroup === null) return;
  const members = groupMembers.get(currentGroup)!;
  if (tok.from !== '[*]') members.add(tok.from);
  if (tok.to !== '[*]') members.add(tok.to);
}

function collectDeclarations(tokens: Token[]): CollectResult {
  const declared = new Map<string, 'choice' | 'fork' | 'join'>();
  const groupMembers = new Map<string, Set<string>>();
  const groupStack: string[] = [];
  const state = { depth: 0, currentGroup: null as string | null };

  for (const tok of tokens) {
    if (tok.kind === 'stateDecl') {
      declared.set(tok.id, tok.stateType);
    } else if (tok.kind === 'groupOpen') {
      handleGroupOpen(tok, groupMembers, groupStack, state);
    } else if (tok.kind === 'groupClose') {
      handleGroupClose(groupStack, state);
    } else if (tok.kind === 'transition') {
      handleTransitionDecl(tok, groupMembers, state.currentGroup);
    }
  }

  return { declared, groupMembers };
}

// ── Build helpers ────────────────────────────────────────────────────────────

function ensureState(ctx: BuildContext, id: string): void {
  if (ctx.ensured.has(id)) return;
  ctx.ensured.add(id);
  const type = ctx.declared.get(id);
  if (type === 'choice') { ctx.builder.createChoice(id as StateId); return; }
  if (type === 'fork') { ctx.builder.createFork(id as StateId); return; }
  if (type === 'join') { ctx.builder.createJoin(id as StateId); return; }
  if (ctx.groupMembers.has(id)) {
    ctx.builder.createGroup(id as StateId);
    for (const memberId of ctx.groupMembers.get(id)!) {
      ensureState(ctx, memberId);
      const gs = ctx.sm.getState(id as StateId);
      const ms = ctx.sm.getState(memberId as StateId);
      if (gs && ms) (gs as GroupState).addState(ms);
    }
    return;
  }
  ctx.builder.createState(id as StateId);
}

function ensureInitial(ctx: BuildContext, context: string | null): string {
  const key = context ?? '__root__';
  if (ctx.initIds.has(key)) return ctx.initIds.get(key)!;
  const id = context ? `${context}__initial` : 'initial';
  ctx.builder.createInitial(id as StateId);
  if (context) {
    const gs = ctx.sm.getState(context as StateId) as GroupState;
    const is = ctx.sm.getState(id as StateId)!;
    gs?.addState(is);
  }
  ctx.initIds.set(key, id);
  return id;
}

function ensureTerminal(ctx: BuildContext, context: string | null): string {
  const key = context ?? '__root__';
  if (ctx.termIds.has(key)) return ctx.termIds.get(key)!;
  const id = context ? `${context}__terminal` : 'terminal';
  ctx.builder.createTerminal(id as StateId);
  if (context) {
    const gs = ctx.sm.getState(context as StateId) as GroupState;
    const ts = ctx.sm.getState(id as StateId)!;
    gs?.addState(ts);
  }
  ctx.termIds.set(key, id);
  return id;
}

function parseTransitionLabel(label: string | undefined): LabelResult {
  if (!label) return { status: undefined, exitCode: undefined };
  const parts = label.split('/');
  if (parts.length > 2) {
    throw new SMValidationException(
      `Malformed transition label '${label}' — at most one '/' allowed`,
    );
  }
  const rawStatus = parts[0]?.trim().toLowerCase();
  let status: StateStatus | undefined;
  if (rawStatus) {
    status = STATUS_MAP[rawStatus];
    if (status === undefined) {
      throw new SMValidationException(`Unknown status label '${parts[0]}' in transition`);
    }
  }
  return { status, exitCode: parts[1]?.trim() || undefined };
}

function processTransition(
  ctx: BuildContext,
  tok: Extract<Token, { kind: 'transition' }>,
  currentGroup: string | null,
): void {
  const fromId = tok.from === '[*]' ? ensureInitial(ctx, currentGroup) : tok.from;
  const toId = tok.to === '[*]' ? ensureTerminal(ctx, currentGroup) : tok.to;
  if (tok.from !== '[*]') ensureState(ctx, tok.from);
  if (tok.to !== '[*]') ensureState(ctx, tok.to);
  const { status, exitCode } = parseTransitionLabel(tok.label);
  const guardKey = [status ?? '', exitCode ?? ''].filter(Boolean).join('/');
  const tId = (guardKey ? `${fromId}-->${toId}:${guardKey}` : `${fromId}-->${toId}`) as TransitionId;
  ctx.builder.createTransition(tId, fromId as StateId, toId as StateId, status, exitCode);
}

// ── Pass 2 ───────────────────────────────────────────────────────────────────

function buildTransitions(ctx: BuildContext, tokens: Token[]): void {
  let currentGroup: string | null = null;
  const groupDepthStack: (string | null)[] = [];

  for (const tok of tokens) {
    if (tok.kind === 'groupOpen') {
      groupDepthStack.push(currentGroup);
      currentGroup = tok.id;
      ensureState(ctx, tok.id);
    } else if (tok.kind === 'groupClose') {
      currentGroup = groupDepthStack.pop() ?? null;
    } else if (tok.kind === 'transition') {
      processTransition(ctx, tok, currentGroup);
    }
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function parseMermaid(diagramText: string): StateMachine {
  const title = extractTitle(diagramText) || randomUUID();
  const tokens = tokenize(diagramText);
  const sm = new BasicStateMachine(title as StateMachineId);
  const { declared, groupMembers } = collectDeclarations(tokens);

  const ctx: BuildContext = {
    sm,
    builder: new StateMachineBuilder(sm),
    declared,
    groupMembers,
    ensured: new Set(),
    initIds: new Map(),
    termIds: new Map(),
  };

  buildTransitions(ctx, tokens);
  return sm;
}