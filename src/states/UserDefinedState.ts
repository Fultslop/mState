import type { SMStateId} from '../types';
import { SMStateType } from '../types';
import { BaseState } from './BaseState';

export class UserDefinedState extends BaseState {
  constructor(id: SMStateId, config?: Record<string, unknown>) {
    super(id, SMStateType.UserDefined, config);
  }
}
