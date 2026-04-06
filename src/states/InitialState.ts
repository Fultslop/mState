import { SMStateId, SMStateType } from '../types';
import { BaseState } from './BaseState';

export class InitialState extends BaseState {
  readonly payload: unknown;
  constructor(id: SMStateId, payload?: unknown) {
    super(id, SMStateType.Initial);
    this.payload = payload;
  }
}
