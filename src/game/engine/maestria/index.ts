import type { GameContent } from '../../content/types';
import type { Emit } from '../../store/types';
import type { GameState } from '../state';
import { updateSwarm } from './swarm';

export { createMaestriaState, buyMaestriaLevel, freeSlots, maestriaLevel, maestriaNextCost, maestriaSpent, unlockMaestria, unlockedMaestrias } from './slots';
export { goldenCanCrit, goldenReady, goldenSeconds, goldenValue, joinhaClicksNeeded, recordJoinhaClick } from './joinha';
export { fireRollforward, recordRollforwardClick, rollforwardJumpMs, rollforwardMaxCharges } from './rollforward';
export { hitSwarmBug, startSwarm, swarmCharge, swarmChargeMs, swarmMaxSeconds, swarmReady, swarmSeconds, updateSwarm } from './swarm';
export { readMaestria } from './save';
export { atLevel, steadyCoinsPerSecond } from './production';
export type { ActiveSwarm, MaestriaState, SwarmBug } from './types';

/** What the tick does for the Maestrias: spawn, defend and end the swarm in progress. */
export function updateMaestrias(state: GameState, content: GameContent, now: number, rng: () => number, emit: Emit): void {
  updateSwarm(state, content, now, rng, emit);
}

/** What a graduation resets: the counters of the run. Levels and the swarm's charge are kept. */
export function resetMaestriasForGraduation(state: GameState): void {
  state.maestria.joinha = { clicks: 0 };
  state.maestria.rollforward = { clicks: 0, charges: 0 };
  state.maestria.swarm.active = null;
}
