import type { StateContainer } from './StateContainer';
import type { State } from './State';

export interface GroupState extends State, StateContainer {}
