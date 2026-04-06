import type { StateId } from '../model/types';
import { StateType } from '@src/model/State';
import { BaseState } from './BaseState';

export class InitialState extends BaseState {
  readonly initialPayload: unknown;
  constructor(id: StateId, payload?: unknown, parentId?: StateId) {
    super(id, StateType.Initial, undefined, parentId);
    this.initialPayload = payload;
  }
}
