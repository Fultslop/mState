import { SMStatus, SMStateType } from '@src/types';

describe('SMStatus', () => {
  it('has expected values', () => {
    expect(SMStatus.None).toBe('none');
    expect(SMStatus.Active).toBe('active');
    expect(SMStatus.Ok).toBe('ok');
    expect(SMStatus.Error).toBe('error');
    expect(SMStatus.Canceled).toBe('canceled');
    expect(SMStatus.Exception).toBe('exception');
    expect(SMStatus.AnyStatus).toBe('any');
  });
});

describe('SMStateType', () => {
  it('has expected values', () => {
    expect(SMStateType.Initial).toBe('initial');
    expect(SMStateType.Terminal).toBe('terminal');
    expect(SMStateType.Choice).toBe('choice');
    expect(SMStateType.Fork).toBe('fork');
    expect(SMStateType.Join).toBe('join');
    expect(SMStateType.Group).toBe('group');
    expect(SMStateType.UserDefined).toBe('userDefined');
  });
});
