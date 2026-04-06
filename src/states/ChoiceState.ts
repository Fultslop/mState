import { SMStateId, SMStateType } from '../types';
import { BaseState } from './BaseState';

export class ChoiceState extends BaseState {
  constructor(id: SMStateId) { super(id, SMStateType.Choice); }
}
