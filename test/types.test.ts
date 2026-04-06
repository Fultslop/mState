import { StateStatus, StateType } from "@src/IState";

describe('SMStatus', () => {
  it('has expected values', () => {
    expect(StateStatus.None).toBe('none');
    expect(StateStatus.Active).toBe('active');
    expect(StateStatus.Ok).toBe('ok');
    expect(StateStatus.Error).toBe('error');
    expect(StateStatus.Canceled).toBe('canceled');
    expect(StateStatus.Exception).toBe('exception');
    expect(StateStatus.AnyStatus).toBe('any');
  });
});

describe('SMStateType', () => {
  it('has expected values', () => {
    expect(StateType.Initial).toBe('initial');
    expect(StateType.Terminal).toBe('terminal');
    expect(StateType.Choice).toBe('choice');
    expect(StateType.Fork).toBe('fork');
    expect(StateType.Join).toBe('join');
    expect(StateType.Group).toBe('group');
    expect(StateType.UserDefined).toBe('userDefined');
  });
});
