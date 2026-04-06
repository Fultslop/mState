import type { StateId} from '../types';
import { StateType } from "@src/IState";
import { BaseState } from './BaseState';

export class ForkState extends BaseState {
  readonly clonePayload: ((p: unknown) => unknown) | undefined;
  constructor(id: StateId, clonePayload?: (p: unknown) => unknown) {
    super(id, StateType.Fork);
    this.clonePayload = clonePayload;
  }
}
