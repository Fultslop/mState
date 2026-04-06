import type { StateId } from '../model/types';
import { StateType } from '@src/model/State';
import { BaseState } from './BasicState';

export class UserDefinedState extends BaseState {
  constructor(id: StateId, config?: Record<string, unknown>, parentId?: StateId ) {
    super(id, StateType.UserDefined, config, parentId);
  }
}
