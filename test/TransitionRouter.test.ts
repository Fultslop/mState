import { StateStatus } from "@src/model/State";
import type { StateId, TransitionId } from '@src/model/types';
import type { Transition } from '@src/model/Transition';
import type { State } from '@src/model/State';
import { StateRegistry } from '@src/base/StateRegistry';
import { TransitionRegistry } from '@src/base/TransitionRegistry';
import { TransitionRouter } from '@src/base/TransitionRouter';
import { SMRuntimeException } from "@src/base/SMRuntimeException";
import { BasicTransition } from '@src/base/BasicTransition';
import { TerminalState } from '@src/base/TerminalState';
import { UserDefinedState } from '@src/base/UserDefinedState';
import { ChoiceState } from '@src/base/ChoiceState';
import { ForkState } from '@src/base/ForkState';

const sid = (s: string) => s as StateId;
const tid = (s: string) => s as TransitionId;

function makeRouter(
  states: Record<string, State>,
  transitions: Transition[],
) {
  const sr = new StateRegistry();
  const tr = new TransitionRegistry();
  for (const s of Object.values(states)) sr.add(s);
  for (const t of transitions) {
    tr.add(t);
    states[t.fromStateId]?.outgoing.add(t.id);
    states[t.toStateId]?.incoming.add(t.id);
  }
  return new TransitionRouter(sr, tr);
}

describe('TransitionRouter', () => {
  it('throws SMRuntimeException for unknown fromStateId', () => {
    const router = makeRouter({}, []);
    expect(() => router.resolve(sid('x'), StateStatus.Ok))
      .toThrow(SMRuntimeException);
  });

  it('returns none when state has no outgoing transitions', () => {
    const s = new UserDefinedState(sid('a'));
    const router = makeRouter({ a: s }, []);
    expect(router.resolve(sid('a'), StateStatus.Ok)).toEqual({ kind: 'none' });
  });

  it('resolves an unqualified transition (matches any status)', () => {
    const a = new UserDefinedState(sid('a'));
    const b = new UserDefinedState(sid('b'));
    const t = new BasicTransition(tid('t1'), sid('a'), sid('b'));
    const router = makeRouter({ a, b }, [t]);
    const result = router.resolve(sid('a'), StateStatus.Error);
    expect(result).toEqual({ kind: 'transition', transitionIds: [tid('t1')] });
  });

  it('resolves a status-qualified transition when status matches', () => {
    const a = new UserDefinedState(sid('a'));
    const b = new UserDefinedState(sid('b'));
    const t = new BasicTransition(tid('t1'), sid('a'), sid('b'), StateStatus.Ok);
    const router = makeRouter({ a, b }, [t]);
    expect(router.resolve(sid('a'), StateStatus.Ok)).toEqual({ kind: 'transition', transitionIds: [tid('t1')] });
  });

  it('returns noMatch when qualified transition does not match', () => {
    const a = new UserDefinedState(sid('a'));
    const b = new UserDefinedState(sid('b'));
    const t = new BasicTransition(tid('t1'), sid('a'), sid('b'), StateStatus.Ok);
    const router = makeRouter({ a, b }, [t]);
    expect(router.resolve(sid('a'), StateStatus.Error)).toEqual({ kind: 'noMatch' });
  });

  it('returns terminal when target is a TerminalState', () => {
    const a = new UserDefinedState(sid('a'));
    const term = new TerminalState(sid('term'));
    const t = new BasicTransition(tid('t1'), sid('a'), sid('term'));
    const router = makeRouter({ a, term }, [t]);
    expect(router.resolve(sid('a'), StateStatus.Ok))
      .toEqual({ kind: 'terminal', terminalId: sid('term') });
  });

  it('routes transparently through a Choice node', () => {
    const a  = new UserDefinedState(sid('a'));
    const ch = new ChoiceState(sid('ch'));
    const b  = new UserDefinedState(sid('b'));
    const c  = new UserDefinedState(sid('c'));
    const t1 = new BasicTransition(tid('t1'), sid('a'), sid('ch'));
    const t2 = new BasicTransition(tid('t2'), sid('ch'), sid('b'), StateStatus.Ok);
    const t3 = new BasicTransition(tid('t3'), sid('ch'), sid('c'), StateStatus.Error);
    const router = makeRouter({ a, ch, b, c }, [t1, t2, t3]);
    expect(router.resolve(sid('a'), StateStatus.Ok)).toEqual({ kind: 'transition', transitionIds: [tid('t2')] });
    expect(router.resolve(sid('a'), StateStatus.Error)).toEqual({ kind: 'transition', transitionIds: [tid('t3')] });
  });

  it('AnyStatus transition matches any incoming status', () => {
    const a = new UserDefinedState(sid('a'));
    const b = new UserDefinedState(sid('b'));
    const t = new BasicTransition(tid('t1'), sid('a'), sid('b'), StateStatus.AnyStatus);
    const router = makeRouter({ a, b }, [t]);
    expect(router.resolve(sid('a'), StateStatus.Error)).toEqual({ kind: 'transition', transitionIds: [tid('t1')] });
    expect(router.resolve(sid('a'), StateStatus.Exception)).toEqual({ kind: 'transition', transitionIds: [tid('t1')] });
  });

  it('resolves status+exitCode combination', () => {
    const a  = new UserDefinedState(sid('a'));
    const b1 = new UserDefinedState(sid('b1'));
    const b2 = new UserDefinedState(sid('b2'));
    const t1 = new BasicTransition(tid('t1'), sid('a'), sid('b1'), StateStatus.Ok, 'planA');
    const t2 = new BasicTransition(tid('t2'), sid('a'), sid('b2'), StateStatus.Ok, 'planB');
    const router = makeRouter({ a, b1, b2 }, [t1, t2]);
    expect(router.resolve(sid('a'), StateStatus.Ok, 'planA')).toEqual({ kind: 'transition', transitionIds: [tid('t1')] });
    expect(router.resolve(sid('a'), StateStatus.Ok, 'planB')).toEqual({ kind: 'transition', transitionIds: [tid('t2')] });
  });

  it('Fork returns ALL outgoing transitions', () => {
    const fork = new ForkState(sid('fork'));
    const b    = new UserDefinedState(sid('b'));
    const c    = new UserDefinedState(sid('c'));
    const t1   = new BasicTransition(tid('t1'), sid('fork'), sid('b'));
    const t2   = new BasicTransition(tid('t2'), sid('fork'), sid('c'));
    const router = makeRouter({ fork, b, c }, [t1, t2]);
    const result = router.resolve(sid('fork'), StateStatus.Ok);
    expect(result.kind).toBe('transition');
    if (result.kind === 'transition') {
      expect(result.transitionIds).toHaveLength(2);
      expect(result.transitionIds).toContain(tid('t1'));
      expect(result.transitionIds).toContain(tid('t2'));
    }
  });
});
