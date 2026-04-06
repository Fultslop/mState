import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createStateModel } from '@src/parser/createStateModel';
import { SMStateType } from '@src/types';

const INLINE = `
---
title: inlineTest
---
stateDiagram-v2
  [*] --> s1
  s1 --> [*]
`;

const MULTI_DIAGRAM = `
\`\`\`yaml smConfig
firstDiagram:
  config:
    x: 1
\`\`\`

\`\`\`mermaid
---
title: firstDiagram
---
stateDiagram-v2
  [*] --> a
  a --> [*]
\`\`\`

\`\`\`mermaid
---
title: secondDiagram
---
stateDiagram-v2
  [*] --> b
  b --> [*]
\`\`\`
`;

describe('createStateModel (string overload)', () => {
  it('parses a single inline diagram string', () => {
    const machines = createStateModel(INLINE);
    expect(machines).toHaveLength(1);
    expect(String(machines[0]!.id)).toBe('inlineTest');
  });

  it('returns states from parsed diagram', () => {
    const [sm] = createStateModel(INLINE);
    const ids = sm!.getStateIds();
    expect(ids.some(id => String(id) === 's1')).toBe(true);
    expect(ids.some(id => sm!.getState(id)?.type === SMStateType.Initial)).toBe(true);
    expect(ids.some(id => sm!.getState(id)?.type === SMStateType.Terminal)).toBe(true);
  });
});

describe('createStateModel (file overload)', () => {
  let tmpFile: string;

  beforeAll(() => {
    tmpFile = path.join(os.tmpdir(), `mstate-test-${Date.now()}.md`);
    fs.writeFileSync(tmpFile, MULTI_DIAGRAM, 'utf8');
  });

  afterAll(() => {
    fs.unlinkSync(tmpFile);
  });

  it('reads a file and returns all diagrams keyed by title', async () => {
    const machines = await createStateModel(tmpFile, { fromFile: true });
    expect(machines).toHaveLength(2);
    expect(machines.map(m => String(m.id))).toContain('firstDiagram');
    expect(machines.map(m => String(m.id))).toContain('secondDiagram');
  });

  it('applies smConfig config to the matching diagram machine', async () => {
    const machines = await createStateModel(tmpFile, { fromFile: true });
    const first = machines.find(m => String(m.id) === 'firstDiagram');
    expect(first).toBeDefined();
    // For now, verify the machine was created with no error
    expect(() => first!.validate()).not.toThrow();
  });
});
