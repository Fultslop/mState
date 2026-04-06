import type { StateId } from '../model/types';
import { StateType } from '@src/model/State';
import { BaseState } from './BasicState';

export class ForkState extends BaseState {
  readonly clonePayload: ((p: unknown) => unknown) | undefined;

  constructor(id: StateId, clonePayload?: (p: unknown) => unknown, parentId?: StateId) {
    super(id, StateType.Fork, undefined, parentId);
    this.clonePayload = clonePayload;
  }
}
