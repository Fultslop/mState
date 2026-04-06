import type { SMStateId} from '../types';
import { SMStateType } from '../types';
import { BaseState } from './BaseState';

export class ForkState extends BaseState {
  readonly clonePayload: ((p: unknown) => unknown) | undefined;
  constructor(id: SMStateId, clonePayload?: (p: unknown) => unknown) {
    super(id, SMStateType.Fork);
    this.clonePayload = clonePayload;
  }
}
