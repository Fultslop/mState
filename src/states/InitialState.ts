import type { StateId } from '../types';
import { StateType } from '@src/IState';
import { BaseState } from './BaseState';

export class InitialState extends BaseState {
  readonly initialPayload: unknown;
  constructor(id: StateId, payload?: unknown, parentId?: StateId) {
    super(id, StateType.Initial, undefined, parentId);
    this.initialPayload = payload;
  }
}
