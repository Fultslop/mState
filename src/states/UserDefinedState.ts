import type { StateId} from '../types';
import { StateType } from "@src/IState";
import { BaseState } from './BaseState';

export class UserDefinedState extends BaseState {
  constructor(id: StateId, config?: Record<string, unknown>) {
    super(id, StateType.UserDefined, config);
  }
}
