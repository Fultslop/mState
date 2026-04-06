import type { StateId } from '../model/types';
import { StateType } from '@src/model/State';
import { BaseState } from './BasicState';

export class TerminalState extends BaseState {
  constructor(id: StateId, parentId? : StateId) {
    super(id, StateType.Terminal, undefined, parentId);
  }
}
