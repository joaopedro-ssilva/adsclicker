import type { GameContent } from '../../content/types';
import { Decimal, parseDecimal } from '../decimal';
import { rarityRank } from './items';
import type { LabItem } from './types';

/**
 * ADScoins to raise an item one level: levelBase x rarityStep^rarity x levelGrowth^(level - 1). Fixed numbers, a tier
 * above Pablo's hire cost, not minutes of production. Null when the item is at the top level.
 */
export function levelUpCost(content: GameContent, item: LabItem): Decimal | null {
  const { costs, items } = content.lab;
  if (item.level >= items.maxLevel) return null;
  return parseDecimal(costs.levelBase)
    .mul(Decimal.pow(costs.rarityStep, rarityRank(content, item.rarity)))
    .mul(Decimal.pow(costs.levelGrowth, Math.max(1, item.level) - 1));
}

/**
 * ADScoins to roll one affix of the item again: rerollBase x rerollRarityStep^rarity x rerollLevelGrowth^(level - 1)
 * x rerollGrowth^(rerolls already made on this item). Cheaper than a level up of the same item at first, and dearer
 * with every reroll.
 */
export function rerollCost(content: GameContent, item: LabItem): Decimal {
  const { costs } = content.lab;
  return parseDecimal(costs.rerollBase)
    .mul(Decimal.pow(costs.rerollRarityStep, rarityRank(content, item.rarity)))
    .mul(Decimal.pow(costs.rerollLevelGrowth, Math.max(1, item.level) - 1))
    .mul(Decimal.pow(costs.rerollGrowth, Math.min(item.rerolls, 200)));
}
