import type { StateId} from '../types';
import { StateType } from "@src/IState";
import { BaseState } from './BaseState';

export class InitialState extends BaseState {
  readonly payload: unknown;
  constructor(id: StateId, payload?: unknown) {
    super(id, StateType.Initial);
    this.payload = payload;
  }
}
