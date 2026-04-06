import { StateType } from '../model/State';
import type { State } from '../model/State';
import type { StateId } from '../model/types';
import { BaseState } from './BasicState';
import { Region } from './Region';

export class ParallelState extends BaseState {
  readonly payloadClone: ((payload: unknown) => unknown) | undefined;

  private readonly _regions: Region[] = [];

  private readonly _addState: (s: State) => void;

  constructor(
    id: StateId,
    addState: (s: State) => void,
    payloadClone?: (payload: unknown) => unknown,
    parentId?: StateId,
  ) {
    super(id, StateType.Parallel, undefined, parentId);
    this._addState = addState;
    this.payloadClone = payloadClone;
  }

  createRegion(id: string): Region {
    const region = new Region(id, this._addState, this.id);
    this._regions.push(region);
    return region;
  }

  getRegion(id: string): Region | undefined {
    return this._regions.find((region) => region.id === id);
  }

  getRegions(): ReadonlyArray<Region> {
    return this._regions;
  }

  findRegionForState(stateId: StateId): Region | undefined {
    return this._regions.find((region) => region.hasState(stateId));
  }

  findRegionForTerminal(terminalId: StateId): Region | undefined {
    return this._regions.find((region) => region.terminal.id === terminalId);
  }
}
