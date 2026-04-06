import type { StateId } from '../model/types';
import { StateType } from '@src/model/State';
import { BaseState } from './BasicState';

export class ChoiceState extends BaseState {
  constructor(id: StateId, parentId?: StateId) {
    super(id, StateType.Choice, undefined, parentId);
  }
}
