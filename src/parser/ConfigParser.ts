import * as yaml from 'js-yaml';
import { SMValidationException } from '../exceptions';

export interface StateConfig {
  config?: Record<string, unknown> | undefined;
}

export interface DiagramConfig {
  config:  Record<string, unknown> | undefined;
  initial: Record<string, unknown> | undefined;
  states:  Record<string, StateConfig>;
}

export class ConfigParser {
  parse(smConfigYaml: string, diagramTitle: string): DiagramConfig {
    const empty: DiagramConfig = { config: undefined, initial: undefined, states: {} };

    if (!smConfigYaml.trim()) return empty;

    let parsed: unknown;
    try {
      parsed = yaml.load(smConfigYaml);
    } catch (e) {
      throw new SMValidationException(`smConfig YAML parse error: ${(e as Error).message}`);
    }

    if (typeof parsed !== 'object' || parsed === null) return empty;
    const root = parsed as Record<string, unknown>;
    const entry = root[diagramTitle];
    if (typeof entry !== 'object' || entry === null) return empty;

    const block = entry as Record<string, unknown>;
    const config  = isRecord(block['config'])  ? block['config']  : undefined;
    const initial = isRecord(block['initial']) ? block['initial'] : undefined;
    const states: Record<string, StateConfig> = {};

    if (isRecord(block['states'])) {
      for (const [k, v] of Object.entries(block['states'])) {
        if (isRecord(v)) {
          states[k] = { config: isRecord(v['config']) ? v['config'] : undefined };
        }
      }
    }

    return { config, initial, states };
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
