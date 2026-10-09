import { MAESTRIA_MAX_LEVEL, PROFESSOR_IDS } from '../../content/types';
import type { GameContent, ProfessorId } from '../../content/types';
import type { Emit } from '../../store/types';
import { ZERO } from '../decimal';
import type { GameState } from '../state';
import type { MaestriaState } from './types';

export function createMaestriaState(): MaestriaState {
  return {
    levels: {},
    joinha: { clicks: 0 },
    rollforward: { clicks: 0, charges: 0 },
    swarm: { since: 0, seq: 0, active: null },
    festa: { since: 0 },
    horas: { clicks: 0, invasions: 0, sprints: 0, abilities: 0, levels: 0 },
    bolsa: { at: 0, step: 0, fundIndex: 1, fund: { units: ZERO, cost: ZERO }, liquidity: 0, assets: {} },
  };
}

/** Level of a professor's Maestria: 0 = not unlocked. */
export function maestriaLevel(state: GameState, professor: ProfessorId): number {
  return state.maestria.levels[professor] ?? 0;
}

export function unlockedMaestrias(state: GameState): ProfessorId[] {
  return PROFESSOR_IDS.filter((id) => maestriaLevel(state, id) > 0);
}

/** Slots not spent yet: one per graduation ever made, up to one per professor, minus the Maestrias unlocked. */
export function freeSlots(state: GameState): number {
  const earned = Math.min(state.counters.graduations, PROFESSOR_IDS.length);
  return Math.max(0, earned - unlockedMaestrias(state).length);
}

/** Diplomas for the next level, or null when the Maestria is at the top (or not unlocked). */
export function maestriaNextCost(state: GameState, content: GameContent, professor: ProfessorId): number | null {
  const level = maestriaLevel(state, professor);
  if (level <= 0 || level >= MAESTRIA_MAX_LEVEL) return null;
  return content.maestrias.defs[professor].levelCosts[level - 1] ?? null;
}

/** Diplomas already paid for a Maestria's levels (level 1 is free). */
export function maestriaSpent(content: GameContent, professor: ProfessorId, level: number): number {
  const costs = content.maestrias.defs[professor].levelCosts;
  let total = 0;
  for (let i = 0; i < Math.min(level - 1, costs.length); i += 1) total += costs[i] ?? 0;
  return total;
}

/** Puts a free slot on a Maestria that is built and not unlocked yet. Level 1 costs no diplomas. */
export function unlockMaestria(
  state: GameState,
  content: GameContent,
  professor: ProfessorId,
  emit: Emit,
): boolean {
  if (!content.maestrias.defs[professor]?.built) return false;
  if (maestriaLevel(state, professor) > 0 || freeSlots(state) <= 0) return false;
  state.maestria.levels[professor] = 1;
  emit({ type: 'maestria', professor, level: 1 });
  return true;
}

/** Buys the next level with diplomas. */
export function buyMaestriaLevel(state: GameState, content: GameContent, professor: ProfessorId, emit: Emit): boolean {
  const cost = maestriaNextCost(state, content, professor);
  if (cost === null || state.diplomas < cost) return false;
  state.diplomas -= cost;
  const level = maestriaLevel(state, professor) + 1;
  state.maestria.levels[professor] = level;
  emit({ type: 'maestria', professor, level });
  return true;
}
