import * as fs from 'fs';
import type { StateMachine } from '@src/model/StateMachine';
import { parseMermaid } from './MermaidParser';
import { parseConfig } from './ConfigParser';

const FENCED_BLOCK_RE = /```(\w+)([^\n]*)\n([\s\S]*?)```/g;

interface ExtractedBlock {
  lang: string;
  info: string;
  content: string;
}

function extractBlocks(markdown: string): ExtractedBlock[] {
  const blocks: ExtractedBlock[] = [];
  FENCED_BLOCK_RE.lastIndex = 0;
  
  let m: RegExpExecArray | null = FENCED_BLOCK_RE.exec(markdown);
  
  while (m) {
    blocks.push({ lang: m[1]!, info: m[2]!.trim(), content: m[3]! });
    m = FENCED_BLOCK_RE.exec(markdown);
  }

  return blocks;
}

function parseDiagrams(content: string): StateMachine[] {
  const blocks = extractBlocks(content);
  const machines: StateMachine[] = [];

  let pendingConfig: string | null = null;

  for (const block of blocks) {
    if (block.lang === 'yaml' && block.info === 'smConfig') {
      pendingConfig = block.content;
    } else if (block.lang === 'mermaid') {
      const sm = parseMermaid(block.content);
      if (pendingConfig !== null) {
        parseConfig(pendingConfig, String(sm.id));
        // Config available for consumer use; not exposed on ISMStateMachine in v1.
        pendingConfig = null;
      }
      machines.push(sm);
    }
  }

  return machines;
}

// Overload 1: inline diagram string (synchronous)
export function createStateModel(diagram: string): StateMachine[];

// Overload 2: file path (asynchronous)
export function createStateModel(
  filePath: string,
  options: { fromFile: true },
): Promise<StateMachine[]>;

export function createStateModel(
  input: string,
  options?: { fromFile: true },
): StateMachine[] | Promise<StateMachine[]> {
  if (options?.fromFile) {
    return fs.promises.readFile(input, 'utf8').then((content) => parseDiagrams(content));
  }

  // Inline string — could be a raw diagram or a markdown document with fenced blocks
  const blocks = extractBlocks(input);
  if (blocks.some((b) => b.lang === 'mermaid')) {
    return parseDiagrams(input);
  }

  // Treat entire string as a single diagram
  const sm = parseMermaid(input);
  return [sm];
}
