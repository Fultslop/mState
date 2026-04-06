export type Token =
  | { kind: 'transition'; from: string; to: string; label?: string }
  | { kind: 'stateDecl'; id: string; stateType: 'choice' | 'fork' | 'join' }
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
  const m = diagramText.match(/^---\s*\ntitle:\s*(.+?)\s*\n---/m);
  return m?.[1] ?? '';
}

function parseStateDecl(decl: RegExpExecArray): Token | null {
  const rawType = decl[2]!.toLowerCase();
  if (rawType === 'choice' || rawType === 'fork' || rawType === 'join') {
    return { kind: 'stateDecl', id: decl[1]!, stateType: rawType };
  }
  return null;
}

function parseTransition(trans: RegExpExecArray): Token {
  const from = trans[1]!.trim();
  const to = trans[2]!.trim();
  const label = trans[3]?.trim();
  return { kind: 'transition', from, to, ...(label !== undefined ? { label } : {}) };
}

function parseLine(line: string): Token | null {
  if (DIRECTION_RE.test(line)) return { kind: 'direction' };
  const decl = STATE_DECL_RE.exec(line);
  if (decl) return parseStateDecl(decl);
  const grpOpen = GROUP_OPEN_RE.exec(line);
  if (grpOpen) return { kind: 'groupOpen', id: grpOpen[1]! };
  if (GROUP_CLOSE_RE.test(line)) return { kind: 'groupClose' };
  const trans = TRANSITION_RE.exec(line);
  if (trans) return parseTransition(trans);
  return null;
}

export function tokenize(diagramText: string): Token[] {
  const body = diagramText.replace(FRONTMATTER_RE, '').replace(HEADER_RE, '');
  const tokens: Token[] = [];

  for (const raw of body.split('\n')) {
    const line = raw.trim().replace(/%%.*$/, '').trim();
    if (line) {
      const tok = parseLine(line);
      if (tok) tokens.push(tok);
    }
  }

  return tokens;
}
