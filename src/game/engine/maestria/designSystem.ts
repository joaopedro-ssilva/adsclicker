import type { DisciplineDef, GameContent } from '../../content/types';
import type { Emit } from '../../store/types';
import { getIndex } from '../contentIndex';
import { parseDecimal } from '../decimal';
import { levelOf } from '../economy';
import { levelCost, milestonesCrossed } from '../formulas';
import { levelledLock } from '../requirements';
import type { GameState } from '../state';
import { computeStats } from '../stats';
import { atLevel } from './production';
import { activeMaestriaLevel } from './slots';

/** A class that got free levels from a purchase. */
export interface DesignGift {
  id: string;
  levels: number;
}

/** Chance that a level bought reaches other classes; 0 when B2's Maestria is not unlocked. */
export function designSystemChance(state: GameState, content: GameContent): number {
  const level = activeMaestriaLevel(state, 'b2');
  return level > 0 ? atLevel(content.maestrias.designSystem.chance, level) : 0;
}

/** Classes one reach gives a level to. */
export function designSystemReach(state: GameState, content: GameContent): number {
  const level = activeMaestriaLevel(state, 'b2');
  return level > 0 ? atLevel(content.maestrias.designSystem.reach, level) : 0;
}

/**
 * Design System. Called after the player bought `count` levels of the class `id` (from level `from`): each
 * level, up to maxRolls of them, may give one free level to some classes, and only to those whose next level
 * costs less than the level just paid. It flows down, never up. The free levels are invisible to the counters,
 * the run and the sprints (see monitors.ts for the same rule), so the hand-play achievements keep their meaning.
 */
export function applyDesignSystem(
  state: GameState,
  content: GameContent,
  id: string,
  from: number,
  count: number,
  rng: () => number,
  emit: Emit,
): DesignGift[] {
  const chance = designSystemChance(state, content);
  const reach = designSystemReach(state, content);
  if (chance <= 0 || reach <= 0 || count <= 0) return [];

  const index = getIndex(content);
  const stats = computeStats(state, content);
  const baseOf = (def: DisciplineDef) => index.baseCost.get(def.id) ?? parseDecimal('0');
  const source = content.disciplines.find((def) => def.id === id);
  if (!source) return [];

  const rolls = Math.min(count, content.maestrias.designSystem.maxRolls);
  const gifts = new Map<string, number>();
  const crossed: { id: string; level: number }[] = [];

  for (let i = 0; i < rolls; i += 1) {
    if (rng() >= chance) continue;
    const paid = levelCost(baseOf(source), from + count - rolls + i, stats);
    const pool = content.disciplines.filter((def) => {
      if (def.id === id) return false;
      const entry = index.levelled.get(def.id);
      if (!entry || levelledLock(state, content, entry) !== null) return false;
      return levelCost(baseOf(def), levelOf(state, def.id), stats).lt(paid);
    });
    for (let pick = 0; pick < reach && pool.length > 0; pick += 1) {
      const target = pool.splice(Math.min(pool.length - 1, Math.floor(rng() * pool.length)), 1)[0];
      if (!target) break;
      const before = levelOf(state, target.id);
      state.levels[target.id] = before + 1;
      gifts.set(target.id, (gifts.get(target.id) ?? 0) + 1);
      for (const level of milestonesCrossed(before, before + 1, content.balance)) crossed.push({ id: target.id, level });
    }
  }

  const list = [...gifts].map(([giftId, levels]) => ({ id: giftId, levels }));
  if (list.length > 0) {
    state.counters.designFreeLevels += list.reduce((sum, gift) => sum + gift.levels, 0);
    emit({ type: 'designSystem', from: id, gifts: list });
    for (const milestone of crossed) emit({ type: 'milestone', id: milestone.id, level: milestone.level });
  }
  return list;
}
