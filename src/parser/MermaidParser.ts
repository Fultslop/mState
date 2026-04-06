import { randomUUID } from 'crypto';
import type { StateMachineId, StateId, TransitionId } from '../model/types';
import type { GroupState } from '@src/model/GroupState';
import { StateStatus } from '@src/model/State';
import type { StateMachine } from '@src/model/StateMachine';
import { SMValidationException } from '@src/base/SMValidationException';
import { BasicStateMachine } from '../base/BasicStateMachine';
import { extractTitle, tokenize, type Token, type StateDeclarationType } from './tokenizer';
import { StateMachineBuilder } from '@src/base/StateMachineBuilder';

const STATUS_MAP: Record<string, StateStatus> = {
  ok: StateStatus.Ok,
  error: StateStatus.Error,
  canceled: StateStatus.Canceled,
  exception: StateStatus.Exception,
  any: StateStatus.AnyStatus,
};

interface CollectResult {
  declared: Map<string, StateDeclarationType>;
  groupMembers: Map<string, Set<string>>;
}

interface BuildContext {
  stateMachine: BasicStateMachine;
  builder: StateMachineBuilder;
  declared: Map<string, StateDeclarationType>;
  groupMembers: Map<string, Set<string>>;
  ensured: Set<string>;
  initialIds: Map<string, string>;
  terminalIds: Map<string, string>;
}

interface LabelResult {
  status: StateStatus | undefined;
  exitCode: string | undefined;
}

// ── Pass 1 helpers ───────────────────────────────────────────────────────────

function handleGroupOpen(
  token: Extract<Token, { kind: 'groupOpen' }>,
  groupMembers: Map<string, Set<string>>,
  groupStack: string[],
  state: { depth: number; currentGroup: string | null },
): void {
  if (state.depth === 0) state.currentGroup = token.id;
  if (state.currentGroup) {
    groupMembers.set(state.currentGroup, groupMembers.get(state.currentGroup) ?? new Set());
  }
  groupStack.push(token.id);
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
  token: Extract<Token, { kind: 'transition' }>,
  groupMembers: Map<string, Set<string>>,
  currentGroup: string | null,
): void {
  if (currentGroup === null) return;
  const members = groupMembers.get(currentGroup)!;
  if (token.from !== '[*]') members.add(token.from);
  if (token.to !== '[*]') members.add(token.to);
}

function collectDeclarations(tokens: Token[]): CollectResult {
  const declared = new Map<string, StateDeclarationType>();
  const groupMembers = new Map<string, Set<string>>();
  const groupStack: string[] = [];
  const state = { depth: 0, currentGroup: null as string | null };

  for (const token of tokens) {
    if (token.kind === 'stateDecl') {
      declared.set(token.id, token.stateType);
    } else if (token.kind === 'groupOpen') {
      handleGroupOpen(token, groupMembers, groupStack, state);
    } else if (token.kind === 'groupClose') {
      handleGroupClose(groupStack, state);
    } else if (token.kind === 'transition') {
      handleTransitionDecl(token, groupMembers, state.currentGroup);
    }
  }

  return { declared, groupMembers };
}

// ── Build helpers ────────────────────────────────────────────────────────────

function ensureState(ctx: BuildContext, id: string): void {
  if (ctx.ensured.has(id)) return;
  ctx.ensured.add(id);
  const stateType = ctx.declared.get(id);
  switch (stateType) {
    case 'choice': ctx.builder.createChoice(id as StateId); return;
    case 'fork':   ctx.builder.createFork(id as StateId); return;
    case 'join':   ctx.builder.createJoin(id as StateId); return;
    default: break;
  }
  if (ctx.groupMembers.has(id)) {
    ctx.builder.createGroup(id as StateId);
    for (const memberId of ctx.groupMembers.get(id)!) {
      ensureState(ctx, memberId);
      const groupState = ctx.stateMachine.getState(id as StateId);
      const memberState = ctx.stateMachine.getState(memberId as StateId);
      if (groupState && memberState) (groupState as GroupState).addState(memberState);
    }
    return;
  }
  ctx.builder.createState(id as StateId);
}

function ensureInitial(ctx: BuildContext, context: string | null): string {
  const key = context ?? '__root__';
  if (ctx.initialIds.has(key)) return ctx.initialIds.get(key)!;
  const id = context ? `${context}__initial` : 'initial';
  ctx.builder.createInitial(id as StateId);
  if (context) {
    const groupState = ctx.stateMachine.getState(context as StateId) as GroupState;
    const initialState = ctx.stateMachine.getState(id as StateId)!;
    groupState?.addState(initialState);
  }
  ctx.initialIds.set(key, id);
  return id;
}

function ensureTerminal(ctx: BuildContext, context: string | null): string {
  const key = context ?? '__root__';
  if (ctx.terminalIds.has(key)) return ctx.terminalIds.get(key)!;
  const id = context ? `${context}__terminal` : 'terminal';
  ctx.builder.createTerminal(id as StateId);
  if (context) {
    const groupState = ctx.stateMachine.getState(context as StateId) as GroupState;
    const terminalState = ctx.stateMachine.getState(id as StateId)!;
    groupState?.addState(terminalState);
  }
  ctx.terminalIds.set(key, id);
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
  token: Extract<Token, { kind: 'transition' }>,
  currentGroup: string | null,
): void {
  const fromId = token.from === '[*]' ? ensureInitial(ctx, currentGroup) : token.from;
  const toId = token.to === '[*]' ? ensureTerminal(ctx, currentGroup) : token.to;
  if (token.from !== '[*]') ensureState(ctx, token.from);
  if (token.to !== '[*]') ensureState(ctx, token.to);
  const { status, exitCode } = parseTransitionLabel(token.label);
  const guardKey = [status ?? '', exitCode ?? ''].filter(Boolean).join('/');
  const transitionId = (guardKey
    ? `${fromId}-->${toId}:${guardKey}`
    : `${fromId}-->${toId}`) as TransitionId;
  ctx.builder.createTransition(transitionId, fromId as StateId, toId as StateId, status, exitCode);
}

// ── Pass 2 ───────────────────────────────────────────────────────────────────

function buildTransitions(ctx: BuildContext, tokens: Token[]): void {
  let currentGroup: string | null = null;
  const groupDepthStack: (string | null)[] = [];

  for (const token of tokens) {
    if (token.kind === 'groupOpen') {
      groupDepthStack.push(currentGroup);
      currentGroup = token.id;
      ensureState(ctx, token.id);
    } else if (token.kind === 'groupClose') {
      currentGroup = groupDepthStack.pop() ?? null;
    } else if (token.kind === 'transition') {
      processTransition(ctx, token, currentGroup);
    }
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function parseMermaid(diagramText: string): StateMachine {
  const title = extractTitle(diagramText) || randomUUID();
  const tokens = tokenize(diagramText);
  const stateMachine = new BasicStateMachine(title as StateMachineId);
  const { declared, groupMembers } = collectDeclarations(tokens);

  const ctx: BuildContext = {
    stateMachine,
    builder: new StateMachineBuilder(stateMachine),
    declared,
    groupMembers,
    ensured: new Set(),
    initialIds: new Map(),
    terminalIds: new Map(),
  };

  buildTransitions(ctx, tokens);
  return stateMachine;
}
