/* eslint-disable @typescript-eslint/no-use-before-define */
import { randomUUID } from 'crypto';
import type {
  StateMachineId,
  StateId,
  TransitionId,
} from '../model/types';
import type { GroupState } from '@src/model/GroupState';
import { StateStatus } from '@src/model/State';
import type { StateMachine } from '@src/model/StateMachine';
import { SMValidationException } from '@src/base/SMValidationException';
import { BasicStateMachine } from '../base/BasicStateMachine';
import {
  extractTitle,
  tokenize,
  TOKEN_KIND,
  STATE_DECLARATION_TYPES,
  type Token,
  type StateDeclarationType,
} from './tokenizer';
import { StateMachineBuilder } from '@src/base/StateMachineBuilder';

const STATUS_MAP: Record<string, StateStatus> = {
  ok: StateStatus.Ok,
  error: StateStatus.Error,
  canceled: StateStatus.Canceled,
  exception: StateStatus.Exception,
  any: StateStatus.AnyStatus,
};

const STAR = '[*]';

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

// ── Pass 1 helpers ──────────────────────────────────────────────────────────

function handleGroupOpen(
  token: Extract<Token, { kind: 'groupOpen' }>,
  groupMembers: Map<string, Set<string>>,
  groupStack: string[],
  groupState: { depth: number; currentGroup: string | null },
): void {
  if (groupState.depth === 0) {
    groupState.currentGroup = token.id;
  }
  if (groupState.currentGroup) {
    const members = groupMembers.get(groupState.currentGroup);
    groupMembers.set(
      groupState.currentGroup,
      members ?? new Set(),
    );
  }
  groupStack.push(token.id);
  groupState.depth += 1;
}

function handleGroupClose(
  groupStack: string[],
  groupState: { depth: number; currentGroup: string | null },
): void {
  groupStack.pop();
  groupState.depth -= 1;
  if (groupState.depth === 0) {
    groupState.currentGroup = null;
  }
}

function handleTransitionDecl(
  token: Extract<Token, { kind: 'transition' }>,
  groupMembers: Map<string, Set<string>>,
  currentGroup: string | null,
): void {
  if (currentGroup !== null) {
    const members = groupMembers.get(currentGroup)!;
    if (token.from !== STAR) {
      members.add(token.from);
    }
    if (token.to !== STAR) {
      members.add(token.to);
    }
  }
}

function collectDeclarations(tokens: Token[]): CollectResult {
  const declared = new Map<string, StateDeclarationType>();
  const groupMembers = new Map<string, Set<string>>();
  const groupStack: string[] = [];
  const groupState = { depth: 0, currentGroup: null as string | null };

  for (const token of tokens) {
    if (token.kind === TOKEN_KIND.StateDecl) {
      declared.set(token.id, token.stateType);
    } else if (token.kind === TOKEN_KIND.GroupOpen) {
      handleGroupOpen(token, groupMembers, groupStack, groupState);
    } else if (token.kind === TOKEN_KIND.GroupClose) {
      handleGroupClose(groupStack, groupState);
    } else if (token.kind === TOKEN_KIND.Transition) {
      handleTransitionDecl(token, groupMembers, groupState.currentGroup);
    }
  }

  return { declared, groupMembers };
}

// ── Build helpers ───────────────────────────────────────────────────────────

function handleGroupMembers(
  ctx: BuildContext,
  id: string,
): boolean {
  let handled = false;
  if (ctx.groupMembers.has(id)) {
    ctx.builder.createGroup(id as StateId);
    const memberIdSet = ctx.groupMembers.get(id)!;
    for (const memberId of memberIdSet) {
      ensureState(ctx, memberId);
      const groupState = ctx.stateMachine.getState(
        id as StateId,
      );
      const memberState = ctx.stateMachine.getState(
        memberId as StateId,
      );
      if (groupState && memberState) {
        (groupState as GroupState).addState(memberState);
      }
    }
    handled = true;
  }
  return handled;
}

function ensureState(ctx: BuildContext, id: string): void {
  if (!ctx.ensured.has(id)) {
    ctx.ensured.add(id);
    const stateType = ctx.declared.get(id);
    let handled = false;
    if (
      stateType === STATE_DECLARATION_TYPES[0]
    ) {
      ctx.builder.createChoice(id as StateId);
      handled = true;
    }
    if (
      stateType === STATE_DECLARATION_TYPES[1]
    ) {
      ctx.builder.createFork(id as StateId);
      handled = true;
    }
    if (
      stateType === STATE_DECLARATION_TYPES[2]
    ) {
      ctx.builder.createJoin(id as StateId);
      handled = true;
    }
    if (!handled) {
      handled = handleGroupMembers(ctx, id);
    }
    if (!handled) {
      ctx.builder.createState(id as StateId);
    }
  }
}

function ensureInitial(
  ctx: BuildContext,
  context: string | null,
): string {
  const key = context ?? '__root__';
  let result: string;
  if (ctx.initialIds.has(key)) {
    result = ctx.initialIds.get(key)!;
  } else {
    const id = context
      ? `${context}__initial`
      : 'initial';
    ctx.builder.createInitial(id as StateId);
    if (context) {
      const groupState = ctx.stateMachine.getState(
        context as StateId,
      ) as GroupState;
      const initialState = ctx.stateMachine.getState(
        id as StateId,
      )!;
      groupState?.addState(initialState);
    }
    ctx.initialIds.set(key, id);
    result = id;
  }
  return result;
}

function ensureTerminal(
  ctx: BuildContext,
  context: string | null,
): string {
  const key = context ?? '__root__';
  let result: string;
  if (ctx.terminalIds.has(key)) {
    result = ctx.terminalIds.get(key)!;
  } else {
    const id = context
      ? `${context}__terminal`
      : 'terminal';
    ctx.builder.createTerminal(id as StateId);
    if (context) {
      const groupState = ctx.stateMachine.getState(
        context as StateId,
      ) as GroupState;
      const terminalState = ctx.stateMachine.getState(
        id as StateId,
      )!;
      groupState?.addState(terminalState);
    }
    ctx.terminalIds.set(key, id);
    result = id;
  }
  return result;
}

function parseTransitionLabel(label: string | undefined): LabelResult {
  let result: LabelResult;
  if (!label) {
    result = { status: undefined, exitCode: undefined };
  } else {
    const parts = label.split('/');
    if (parts.length > 2) {
      throw new SMValidationException(
        `Malformed transition label '${label}' — ` +
          'at most one \'/\' allowed',
      );
    }
    const rawStatus = parts[0]?.trim().toLowerCase();
    let status: StateStatus | undefined;
    if (rawStatus) {
      status = STATUS_MAP[rawStatus];
      if (status === undefined) {
        throw new SMValidationException(
          `Unknown status label '${parts[0]}' in transition`,
        );
      }
    }
    result = {
      status,
      exitCode: parts[1]?.trim() || undefined,
    };
  }
  return result;
}

function processTransition(
  ctx: BuildContext,
  token: Extract<Token, { kind: 'transition' }>,
  currentGroup: string | null,
): void {
  const fromId =
    token.from === STAR
      ? ensureInitial(ctx, currentGroup)
      : token.from;
  const toId =
    token.to === STAR
      ? ensureTerminal(ctx, currentGroup)
      : token.to;
  if (token.from !== STAR) {
    ensureState(ctx, token.from);
  }
  if (token.to !== STAR) {
    ensureState(ctx, token.to);
  }
  const { status, exitCode } = parseTransitionLabel(
    token.label,
  );
  const guardKey = [status ?? '', exitCode ?? '']
    .filter(Boolean)
    .join('/');
  const transitionId = (
    guardKey
      ? `${fromId}-->${toId}:${guardKey}`
      : `${fromId}-->${toId}`
  ) as TransitionId;
  ctx.builder.createTransition(
    transitionId,
    fromId as StateId,
    toId as StateId,
    status,
    exitCode,
  );
}

// ── Pass 2 ──────────────────────────────────────────────────────────────────

function buildTransitions(
  ctx: BuildContext,
  tokens: Token[],
): void {
  let currentGroup: string | null = null;
  const groupDepthStack: (string | null)[] = [];

  for (const token of tokens) {
    if (token.kind === TOKEN_KIND.GroupOpen) {
      groupDepthStack.push(currentGroup);
      currentGroup = token.id;
      ensureState(ctx, token.id);
    } else if (token.kind === TOKEN_KIND.GroupClose) {
      currentGroup = groupDepthStack.pop() ?? null;
    } else if (token.kind === TOKEN_KIND.Transition) {
      processTransition(ctx, token, currentGroup);
    }
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export function parseMermaid(diagramText: string): StateMachine {
  const title = extractTitle(diagramText) || randomUUID();
  const tokens = tokenize(diagramText);
  const stateMachine = new BasicStateMachine(
    title as StateMachineId,
  );
  const { declared, groupMembers } =
    collectDeclarations(tokens);

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
