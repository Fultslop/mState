import type { StateId } from '../types';
import { StateType } from '@src/IState';
import { BaseState } from './BaseState';

export class ChoiceState extends BaseState {
  constructor(id: StateId) {
    super(id, StateType.Choice);
  }
}
