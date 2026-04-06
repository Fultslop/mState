import type { StateId } from '../model/types';
import { StateType } from '@src/model/State';
import { BaseState } from './BaseState';

export class UserDefinedState extends BaseState {
  constructor(id: StateId, config?: Record<string, unknown>, parentId?: StateId ) {
    super(id, StateType.UserDefined, config, parentId);
  }
}
