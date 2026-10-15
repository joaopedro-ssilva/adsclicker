import type { LabSlot } from '../../content/labTypes';
import type { GameContent } from '../../content/types';
import type { Emit } from '../../store/types';
import { spend } from '../economy';
import type { GameState } from '../state';
import { levelUpCost, rerollCost } from './costs';
import { rerollAffix } from './items';
import { LAB_STREAM, labStream } from './state';

/**
 * Raises an equipped item one level with ADScoins (more power and stronger affixes). Allowed at any time once the lab
 * is unlocked, in a fight or between fights, open or closed.
 */
export function levelUpLabItem(state: GameState, content: GameContent, slot: LabSlot, emit: Emit): boolean {
  const { lab } = state;
  const item = lab.turma.equipped[slot];
  if (!lab.unlocked || !item) return false;
  const cost = levelUpCost(content, item);
  if (!cost || state.coins.lt(cost)) return false;
  spend(state, cost);
  item.level += 1;
  lab.counters.itemLevelUps += 1;
  emit({ type: 'labItemChanged', action: 'levelUp', item: item.base, level: item.level });
  return true;
}

/**
 * Rolls one affix of an equipped item again with ADScoins. Index 0 (the primary) keeps its target and draws a new
 * value; the others draw a new affix from the base's pool. Allowed at any time, like the level up. The roll comes from
 * the run's seed, the item and how many rerolls it had, so it can be replayed.
 */
export function rerollLabAffix(state: GameState, content: GameContent, slot: LabSlot, affix: number, emit: Emit): boolean {
  const { lab } = state;
  const item = lab.turma.equipped[slot];
  if (!lab.unlocked || !item) return false;
  const cost = rerollCost(content, item);
  if (state.coins.lt(cost)) return false;
  const seed = lab.turma.run?.seed ?? 0;
  const next = rerollAffix(content, item, Math.floor(affix), labStream(seed, LAB_STREAM.reroll, item.uid * 1000 + Math.min(item.rerolls, 999)));
  if (!next) return false;
  spend(state, cost);
  lab.turma.equipped[slot] = next;
  lab.counters.affixRerolls += 1;
  emit({ type: 'labItemChanged', action: 'reroll', item: next.base, level: next.level });
  return true;
}
