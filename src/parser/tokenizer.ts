export type Token =
  | { kind: 'transition'; from: string; to: string; label?: string }
  | { kind: 'stateDecl'; id: string; stateType: 'choice' | 'fork' | 'join' }
  | { kind: 'groupOpen'; id: string }
  | { kind: 'groupClose' }
  | { kind: 'direction' };

const TRANSITION_RE  = /^(.+?)\s*-->\s*(.+?)(?:\s*:\s*(.*))?$/;
const STATE_DECL_RE  = /^state\s+(\S+)\s+<<(\w+)>>$/;
const GROUP_OPEN_RE  = /^state\s+(\S+)\s*\{$/;
const GROUP_CLOSE_RE = /^\}$/;
const DIRECTION_RE   = /^direction\s+\w+$/;
const FRONTMATTER_RE = /^---[\s\S]*?---/m;
const HEADER_RE      = /^\s*stateDiagram-v2\s*$/m;

export function extractTitle(diagramText: string): string {
  const m = diagramText.match(/^---\s*\ntitle:\s*(.+?)\s*\n---/m);
  return m?.[1] ?? '';
}

export function tokenize(diagramText: string): Token[] {
  const body = diagramText
    .replace(FRONTMATTER_RE, '')
    .replace(HEADER_RE, '');

  const tokens: Token[] = [];
  for (const raw of body.split('\n')) {
    const line = raw.trim().replace(/%%.*$/, '').trim();
    if (!line) continue;

    if (DIRECTION_RE.test(line)) {
      tokens.push({ kind: 'direction' });
      continue;
    }
    const decl = STATE_DECL_RE.exec(line);
    if (decl) {
      const rawType = decl[2]!.toLowerCase();
      if (rawType === 'choice' || rawType === 'fork' || rawType === 'join') {
        tokens.push({ kind: 'stateDecl', id: decl[1]!, stateType: rawType });
      }
      continue;
    }
    const grpOpen = GROUP_OPEN_RE.exec(line);
    if (grpOpen) {
      tokens.push({ kind: 'groupOpen', id: grpOpen[1]! });
      continue;
    }
    if (GROUP_CLOSE_RE.test(line)) {
      tokens.push({ kind: 'groupClose' });
      continue;
    }
    const trans = TRANSITION_RE.exec(line);
    if (trans) {
      const from  = trans[1]!.trim();
      const to    = trans[2]!.trim();
      const label = trans[3]?.trim();
      tokens.push({ kind: 'transition', from, to, label: label ?? undefined });
      continue;
    }
  }
  return tokens;
}
