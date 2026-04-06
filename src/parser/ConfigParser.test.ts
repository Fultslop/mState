import { ConfigParser } from './ConfigParser';
import { SMValidationException } from '../exceptions';

describe('ConfigParser', () => {
  it('returns empty config when no smConfig block is present', () => {
    const result = new ConfigParser().parse('', 'myDiagram');
    expect(result).toEqual({ config: undefined, initial: undefined, states: {} });
  });

  it('parses a matching smConfig block by diagram title', () => {
    const yaml = `
myDiagram:
  config:
    timeout: 5000
  initial:
    seed: 42
  states:
    execute:
      config:
        retries: 3
`;
    const result = new ConfigParser().parse(yaml, 'myDiagram');
    expect(result.config).toEqual({ timeout: 5000 });
    expect(result.initial).toEqual({ seed: 42 });
    expect(result.states['execute']?.config).toEqual({ retries: 3 });
  });

  it('returns empty config when title does not match any key', () => {
    const yaml = `
otherDiagram:
  config:
    x: 1
`;
    const result = new ConfigParser().parse(yaml, 'myDiagram');
    expect(result).toEqual({ config: undefined, initial: undefined, states: {} });
  });

  it('throws SMValidationException for invalid YAML', () => {
    expect(() => new ConfigParser().parse(': invalid: yaml: ::::', 'x')).toThrow(SMValidationException);
  });
});
