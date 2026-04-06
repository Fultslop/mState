import * as fs from 'fs';
import type { ISMStateMachine } from '../interfaces';
import { MermaidParser } from './MermaidParser';
import { ConfigParser } from './ConfigParser';

const FENCED_BLOCK_RE = /```(\w+)([^\n]*)\n([\s\S]*?)```/g;

interface ExtractedBlock {
  lang: string;
  info: string;
  content: string;
}

function extractBlocks(markdown: string): ExtractedBlock[] {
  const blocks: ExtractedBlock[] = [];
  let m: RegExpExecArray | null;
  FENCED_BLOCK_RE.lastIndex = 0;
  while ((m = FENCED_BLOCK_RE.exec(markdown)) !== null) {
    blocks.push({ lang: m[1]!, info: m[2]!.trim(), content: m[3]! });
  }
  return blocks;
}

function parseDiagrams(content: string): ISMStateMachine[] {
  const blocks   = extractBlocks(content);
  const parser   = new MermaidParser();
  const cfgParse = new ConfigParser();
  const machines: ISMStateMachine[] = [];

  let pendingConfig: string | null = null;

  for (const block of blocks) {
    if (block.lang === 'yaml' && block.info === 'smConfig') {
      pendingConfig = block.content;
      continue;
    }
    if (block.lang === 'mermaid') {
      const sm = parser.parse(block.content);
      if (pendingConfig !== null) {
        cfgParse.parse(pendingConfig, String(sm.id));
        // Config available for consumer use; not exposed on ISMStateMachine in v1.
        pendingConfig = null;
      }
      machines.push(sm);
    }
  }

  return machines;
}

// Overload 1: inline diagram string (synchronous)
export function createStateModel(diagram: string): ISMStateMachine[];

// Overload 2: file path (asynchronous)
export function createStateModel(
  filePath: string,
  options: { fromFile: true },
): Promise<ISMStateMachine[]>;

export function createStateModel(
  input: string,
  options?: { fromFile: true },
): ISMStateMachine[] | Promise<ISMStateMachine[]> {
  if (options?.fromFile) {
    return fs.promises.readFile(input, 'utf8').then(content => {
      return parseDiagrams(content);
    });
  }

  // Inline string — could be a raw diagram or a markdown document with fenced blocks
  const blocks = extractBlocks(input);
  if (blocks.some(b => b.lang === 'mermaid')) {
    return parseDiagrams(input);
  }

  // Treat entire string as a single diagram
  const sm = new MermaidParser().parse(input);
  return [sm];
}
