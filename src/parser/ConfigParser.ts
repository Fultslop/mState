import * as yaml from 'js-yaml';
import { SMValidationException } from '@src/base/SMValidationException';

export interface StateConfig {
  config?: Record<string, unknown> | undefined;
}

export interface DiagramConfig {
  config: Record<string, unknown> | undefined;
  initial: Record<string, unknown> | undefined;
  states: Record<string, StateConfig>;
}

const EMPTY: DiagramConfig = { config: undefined, initial: undefined, states: {} };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseStates(statesBlock: Record<string, unknown>): Record<string, StateConfig> {
  const states: Record<string, StateConfig> = {};
  for (const [key, stateEntry] of Object.entries(statesBlock)) {
    if (isRecord(stateEntry)) {
      states[key] = { config: isRecord(stateEntry.config) ? stateEntry.config : undefined };
    }
  }
  return states;
}

function parseBlock(block: Record<string, unknown>): DiagramConfig {
  const config = isRecord(block.config) ? block.config : undefined;
  const initial = isRecord(block.initial) ? block.initial : undefined;
  const states = isRecord(block.states) ? parseStates(block.states) : {};
  return { config, initial, states };
}

export function parseConfig(smConfigYaml: string, diagramTitle: string): DiagramConfig {
  if (!smConfigYaml.trim()) {
return EMPTY;
}

  let parsed: unknown;
  try {
    parsed = yaml.load(smConfigYaml);
  } catch (error) {
    throw new SMValidationException(`smConfig YAML parse error: ${(error as Error).message}`);
  }

  if (!isRecord(parsed)) {
return EMPTY;
}
  const entry = parsed[diagramTitle];
  if (!isRecord(entry)) {
return EMPTY;
}

  return parseBlock(entry);
}
