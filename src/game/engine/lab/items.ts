import { LAB_RARITIES } from '../../content/labTypes';
import type { LabAffixDef, LabItemBase, LabRarity, LabRarityDef, LabSlot } from '../../content/labTypes';
import type { GameContent } from '../../content/types';
import type { Stream } from '../../../hackathon/engine/rng';
import { labIndex } from './state';
import type { LabAffix, LabItem } from './types';

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Item level -> the factor on the level-1 values of the affixes. */
export function levelFactor(content: GameContent, level: number): number {
  return 1 + content.lab.items.valuePerLevel * (Math.max(1, level) - 1);
}

/** What an affix is worth at the item's level. */
export function affixValue(content: GameContent, item: LabItem, affix: LabAffix): number {
  return affix.value * levelFactor(content, item.level);
}

/** Damage per second the item adds: base x rarity x perLevel^(level - 1). */
export function itemPower(content: GameContent, item: LabItem): number {
  const { power } = content.lab.items;
  return power.base * (power.rarity[item.rarity] ?? 1) * power.perLevel ** (Math.max(1, item.level) - 1);
}

export function itemBase(content: GameContent, item: LabItem): LabItemBase | undefined {
  return labIndex(content).bases.get(item.base);
}

/** The legendary version of a base carries its unique effect. */
export function hasUnique(item: LabItem): boolean {
  return item.rarity === 'lendario';
}

export function rarityRank(content: GameContent, rarity: LabRarity): number {
  return labIndex(content).rank[rarity] ?? 0;
}

/** Commits an item gives when recycled: the rarity's value, a little more for each level it was raised. */
export function recycleValue(content: GameContent, item: LabItem): number {
  const rarity = labIndex(content).rarities.get(item.rarity);
  if (!rarity) return 0;
  return Math.floor(rarity.recycleCommits * (1 + content.lab.commits.recycleLevelBonus * (Math.max(1, item.level) - 1)));
}

/**
 * Chance of each rarity (same order as LAB_RARITIES, summing to 1). The weight of the rarity at rank i is multiplied
 * by `1 + quality/100 * i`, so more quality never lowers the chance of reaching any rarity or above.
 */
export function rarityChances(content: GameContent, quality: number): { rarity: LabRarity; chance: number }[] {
  const boost = Math.max(0, quality) / 100;
  const index = labIndex(content);
  const weighted = LAB_RARITIES.map((id, rank) => ({
    rarity: id,
    weight: Math.max(0, index.rarities.get(id)?.weight ?? 0) * (1 + boost * rank),
  }));
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  return weighted.map((entry) => ({ rarity: entry.rarity, chance: total > 0 ? entry.weight / total : 0 }));
}

export function rollRarity(content: GameContent, quality: number, stream: Stream): LabRarity {
  const chances = rarityChances(content, quality);
  const roll = stream();
  let acc = 0;
  for (const entry of chances) {
    acc += entry.chance;
    if (roll < acc) return entry.rarity;
  }
  return chances[chances.length - 1]?.rarity ?? 'comum';
}

/** The rarity at `rank`, not below the floor. */
export function atLeast(content: GameContent, rarity: LabRarity, floor: LabRarity): LabRarity {
  return rarityRank(content, rarity) >= rarityRank(content, floor) ? rarity : floor;
}

function rollAffix(def: LabAffixDef, rarity: LabRarityDef, stream: Stream): LabAffix {
  const t = stream();
  return { target: def.target, op: def.op, value: round1((def.min + t * (def.max - def.min)) * rarity.valueMultiplier) };
}

const sameAffix = (a: { target: string; op: string }, b: { target: string; op: string }) => a.target === b.target && a.op === b.op;

/** A new item (uid 0): the primary affix, then the rarity's extra ones drawn without repeats from the base's pool. */
export function rollItem(content: GameContent, base: LabItemBase, rarityId: LabRarity, level: number, stream: Stream): LabItem {
  const rarity = labIndex(content).rarities.get(rarityId);
  const affixes: LabAffix[] = [];
  if (rarity && base.affixes) {
    affixes.push(rollAffix(base.primary, rarity, stream));
    const candidates = base.pool.filter((def) => !sameAffix(def, base.primary));
    for (let i = 0; i < rarity.extraAffixes && candidates.length > 0; i += 1) {
      const [picked] = candidates.splice(Math.floor(stream() * candidates.length), 1);
      if (picked) affixes.push(rollAffix(picked, rarity, stream));
    }
  }
  return { uid: 0, base: base.id, rarity: rarityId, level: Math.min(content.lab.items.maxLevel, Math.max(1, level)), affixes, rerolls: 0 };
}

/** The affix at `index` rolled again: the primary keeps its target and draws a new value; the others draw a new target too. */
export function rerollAffix(content: GameContent, item: LabItem, index: number, stream: Stream): LabItem | null {
  const base = itemBase(content, item);
  const rarity = labIndex(content).rarities.get(item.rarity);
  if (!base || !rarity || !base.affixes || index < 0 || index >= item.affixes.length) return null;
  const affixes = item.affixes.map((affix) => ({ ...affix }));
  if (index === 0) {
    affixes[0] = rollAffix(base.primary, rarity, stream);
  } else {
    const others = item.affixes.filter((_, i) => i !== index);
    const candidates = base.pool.filter((def) => !others.some((other) => sameAffix(other, def)) && !sameAffix(def, base.primary));
    const def = candidates[Math.floor(stream() * candidates.length)];
    if (!def) return null;
    affixes[index] = rollAffix(def, rarity, stream);
  }
  return { ...item, affixes, rerolls: item.rerolls + 1 };
}

/** The slot an item goes in. */
export function itemSlot(content: GameContent, item: LabItem): LabSlot | null {
  return itemBase(content, item)?.slot ?? null;
}
