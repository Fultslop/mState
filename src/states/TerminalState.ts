import type { StateId} from '../types';
import { StateType } from "@src/IState";
import { BaseState } from './BaseState';

export class TerminalState extends BaseState {
  constructor(id: StateId) { super(id, StateType.Terminal); }
}
