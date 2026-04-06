import { SMStateId, SMStateType } from '../types';
import { BaseState } from './BaseState';

export class TerminalState extends BaseState {
  constructor(id: SMStateId) { super(id, SMStateType.Terminal); }
}
