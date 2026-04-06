import { SMValidationException } from "@src/base/SMValidationException";
import { SMRuntimeException } from "@src/base/SMRuntimeException";

describe('SMValidationException', () => {
  it('is an Error with the right name and message', () => {
    const e = new SMValidationException('bad graph');
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('SMValidationException');
    expect(e.message).toBe('bad graph');
  });
});

describe('SMRuntimeException', () => {
  it('is an Error with the right name and message', () => {
    const e = new SMRuntimeException('bad state');
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('SMRuntimeException');
    expect(e.message).toBe('bad state');
  });
});
