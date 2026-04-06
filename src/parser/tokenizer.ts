export const STATE_DECLARATION_TYPES = ['choice', 'fork', 'join'] as const;
export type StateDeclarationType = typeof STATE_DECLARATION_TYPES[number];

export type Token =
  | { kind: 'transition'; from: string; to: string; label?: string }
  | { kind: 'stateDecl'; id: string; stateType: StateDeclarationType }
  | { kind: 'groupOpen'; id: string }
  | { kind: 'groupClose' }
  | { kind: 'direction' };

const TRANSITION_RE = /^(.+?)\s*-->\s*(.+?)(?:\s*:\s*(.*))?$/;
const STATE_DECL_RE = /^state\s+(\S+)\s+<<(\w+)>>$/;
const GROUP_OPEN_RE = /^state\s+(\S+)\s*\{$/;
const GROUP_CLOSE_RE = /^\}$/;
const DIRECTION_RE = /^direction\s+\w+$/;
const FRONTMATTER_RE = /^---[\s\S]*?---/m;
const HEADER_RE = /^\s*stateDiagram-v2\s*$/m;

export function extractTitle(diagramText: string): string {
  const match = diagramText.match(/^---\s*\ntitle:\s*(.+?)\s*\n---/m);
  return match?.[1] ?? '';
}

function isStateDeclarationType(value: string): value is StateDeclarationType {
  return (STATE_DECLARATION_TYPES as readonly string[]).includes(value);
}

function parseStateDecl(match: RegExpExecArray): Token | null {
  const rawType = match[2]!.toLowerCase();
  if (isStateDeclarationType(rawType)) {
    return { kind: 'stateDecl', id: match[1]!, stateType: rawType };
  }
  return null;
}

function parseTransition(match: RegExpExecArray): Token {
  const from = match[1]!.trim();
  const to = match[2]!.trim();
  const label = match[3]?.trim();
  return { kind: 'transition', from, to, ...(label !== undefined ? { label } : {}) };
}

function parseLine(line: string): Token | null {
  if (DIRECTION_RE.test(line)) return { kind: 'direction' };
  const stateDecl = STATE_DECL_RE.exec(line);
  if (stateDecl) return parseStateDecl(stateDecl);
  const groupOpen = GROUP_OPEN_RE.exec(line);
  if (groupOpen) return { kind: 'groupOpen', id: groupOpen[1]! };
  if (GROUP_CLOSE_RE.test(line)) return { kind: 'groupClose' };
  const transition = TRANSITION_RE.exec(line);
  if (transition) return parseTransition(transition);
  return null;
}

export function tokenize(diagramText: string): Token[] {
  const body = diagramText.replace(FRONTMATTER_RE, '').replace(HEADER_RE, '');
  const tokens: Token[] = [];

  for (const raw of body.split('\n')) {
    const line = raw.trim().replace(/%%.*$/, '').trim();
    if (line) {
      const token = parseLine(line);
      if (token) tokens.push(token);
    }
  }

  return tokens;
}
