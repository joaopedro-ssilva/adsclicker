import type { GameContent } from '../../content/types';
import type { Emit } from '../../store/types';
import type { GameState } from '../state';
import { ZERO } from '../decimal';
import { updateBolsa } from './bolsa';
import { updateFesta } from './festa';
import { updateSwarm } from './swarm';

export { createMaestriaState, buyMaestriaLevel, freeSlots, maestriaLevel, maestriaNextCost, maestriaSpent, unlockMaestria, unlockedMaestrias } from './slots';
export { goldenCanCrit, goldenReady, goldenSeconds, goldenValue, joinhaClicksNeeded, recordJoinhaClick } from './joinha';
export { fireRollforward, recordRollforwardClick, rollforwardJumpMs, rollforwardMaxCharges } from './rollforward';
export { hitSwarmBug, startSwarm, swarmCharge, swarmChargeMs, swarmMaxSeconds, swarmReady, swarmSeconds, updateSwarm } from './swarm';
export { applyDesignSystem, designSystemChance, designSystemReach } from './designSystem';
export { activeFesta, festaCharge, festaReady, festaRechargeMs, startFesta } from './festa';
export { releaseBonusPerVersion, releaseMultiplier, releaseSprintsPerVersion, releaseVersions } from './releases';
export { horasBands, horasBandsFilled, horasCapacity, horasCounted, horasMaxDiplomas, recordHoras } from './horas';
export {
  assetOpen,
  bolsaInvested,
  bolsaLevel,
  bolsaLimit,
  bolsaLimitSeconds,
  bolsaMaxSeconds,
  bolsaRoom,
  bolsaSpend,
  buyAsset,
  depositFund,
  fundRate,
  holdingValue,
  liquidateBolsa,
  nextPrice,
  sellAsset,
  updateBolsa,
  withdrawFund,
} from './bolsa';
export { readMaestria } from './save';
export { atLevel, steadyCoinsPerSecond } from './production';
export type { ActiveSwarm, BolsaAssetState, BolsaHolding, BolsaState, HorasState, MaestriaState, SwarmBug } from './types';

/** What the tick does for the Maestrias: spawn, defend and end the swarm in progress, open the party's recharge and move the market. */
export function updateMaestrias(state: GameState, content: GameContent, now: number, rng: () => number, emit: Emit): void {
  updateSwarm(state, content, now, rng, emit);
  updateFesta(state, now);
  updateBolsa(state, content, now, rng);
}

/**
 * What a graduation resets: the counters of the run. Levels, the charges of the swarm and the party, and the prices of the market
 * are kept. Hours are paid by graduate() before this runs; the Bolsa's holdings were sold by it.
 */
export function resetMaestriasForGraduation(state: GameState): void {
  state.maestria.joinha = { clicks: 0 };
  state.maestria.rollforward = { clicks: 0, charges: 0 };
  state.maestria.swarm.active = null;
  state.maestria.horas = { clicks: 0, invasions: 0, sprints: 0, abilities: 0, levels: 0 };
  const bolsa = state.maestria.bolsa;
  bolsa.fund = { units: ZERO, cost: ZERO };
  for (const id in bolsa.assets) {
    const entry = bolsa.assets[id];
    if (entry) entry.held = { units: ZERO, cost: ZERO };
  }
}
