import type { AffixDef, HackathonContent, ItemBaseDef, ItemRarity, RarityDef } from '../content/types';
import { RARITIES } from '../content/types';
import { indexOf, rarityIndex } from './contentIndex';
import type { DropContext, DropResult, ItemInstance, ResolvedStage, RolledAffix } from './types';

/** Each point of Sorte counts as this many points of loot quality. */
export const SORTE_QUALITY_PER_POINT = 1;
/** Each point of Sorte adds this many percent of chance of an extra drop. */
export const SORTE_EXTRA_DROP_PER_POINT = 0.25;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Rarities in rank order, as the content defines them. */
function orderedRarities(content: HackathonContent): RarityDef[] {
  return [...content.rarities].sort((a, b) => rarityIndex(a.id) - rarityIndex(b.id));
}

/**
 * Chance of each rarity (same order as the content's rarities, summing to 1). The weight of the
 * rarity at rank i is multiplied by `1 + quality/100 * i`: the higher the rank, the bigger the
 * boost, so more quality never lowers the chance of reaching any given rarity or above.
 */
export function rarityChances(quality: number, content: HackathonContent): { rarity: ItemRarity; chance: number }[] {
  const boost = Math.max(0, quality) / 100;
  const weighted = orderedRarities(content).map((r) => ({
    rarity: r.id,
    weight: Math.max(0, r.weight) * (1 + boost * rarityIndex(r.id)),
  }));
  const total = weighted.reduce((sum, r) => sum + r.weight, 0);
  return weighted.map((r) => ({ rarity: r.rarity, chance: total > 0 ? r.weight / total : 0 }));
}

/** Loot quality in percent: the lootQuality meta, Sorte and the daily modifiers. */
export function lootQuality(context: Pick<DropContext, 'build' | 'stage'>): number {
  const daily = context.stage.modifiers.reduce((sum, m) => sum + (m.lootQuality ?? 0), 0);
  return context.build.meta.lootQuality + context.build.stats.sorte * SORTE_QUALITY_PER_POINT + daily;
}

/** Percent chance of one extra item per victory: base + dropExtra meta + Sorte. */
export function extraDropChance(context: Pick<DropContext, 'build'>, content: HackathonContent): number {
  return content.config.baseDropExtra + context.build.meta.dropExtra + context.build.stats.sorte * SORTE_EXTRA_DROP_PER_POINT;
}

function pickRarity(rng: () => number, chances: { rarity: ItemRarity; chance: number }[]): ItemRarity {
  const roll = rng();
  let acc = 0;
  for (const entry of chances) {
    acc += entry.chance;
    if (roll < acc) return entry.rarity;
  }
  return chances[chances.length - 1]?.rarity ?? 'comum';
}

function levelScale(level: number, content: HackathonContent): number {
  return 1 + (content.config.itemValuePercentPerLevel * (Math.max(1, level) - 1)) / 100;
}

/** Draws a value inside the affix range; quality is where it landed, 0 to 100. */
function rollAffix(def: AffixDef, rarity: RarityDef, level: number, rng: () => number, content: HackathonContent): RolledAffix {
  const t = rng();
  const value = (def.min + t * (def.max - def.min)) * rarity.valueMultiplier * levelScale(level, content);
  return { target: def.target, op: def.op, value: round1(value), quality: Math.round(t * 100) };
}

function averageQuality(affixes: RolledAffix[]): number {
  if (affixes.length === 0) return 0;
  return round1(affixes.reduce((sum, a) => sum + a.quality, 0) / affixes.length);
}

const sameAffix = (a: { target: string; op: string }, b: { target: string; op: string }): boolean =>
  a.target === b.target && a.op === b.op;

export function rollItem(
  base: ItemBaseDef,
  rarity: RarityDef,
  level: number,
  context: Pick<DropContext, 'rng' | 'now' | 'newId'>,
  content: HackathonContent,
): ItemInstance {
  const { rng } = context;
  const affixes = [rollAffix(base.primary, rarity, level, rng, content)];
  const candidates = base.pool.filter((def) => !sameAffix(def, base.primary));
  for (let i = 0; i < rarity.extraAffixes && candidates.length > 0; i += 1) {
    const [picked] = candidates.splice(Math.floor(rng() * candidates.length), 1);
    if (picked) affixes.push(rollAffix(picked, rarity, level, rng, content));
  }
  return {
    id: context.newId(),
    base: base.id,
    rarity: rarity.id,
    level,
    affixes,
    quality: averageQuality(affixes),
    rerolls: 0,
    createdAt: context.now,
  };
}

export function dropCount(stage: ResolvedStage, extra: boolean, content: HackathonContent): number {
  return (stage.boss ? content.config.bossDrops : 1) + (extra ? 1 : 0);
}

/**
 * Drops of one victory. Order of `rng` use is fixed: the extra-drop roll, then per item the base,
 * the rarity and the affixes. The first item is raised to the pity rarity (legendary once
 * `pityVictories` victories passed without one) and to the first-clear minimum.
 */
export function rollDrops(context: DropContext, content: HackathonContent): DropResult {
  const index = indexOf(content);
  const bases = context.stage.drops.flatMap((id) => index.items.get(id) ?? []);
  const extra = context.rng() * 100 < extraDropChance(context, content);
  const count = dropCount(context.stage, extra, content);
  const chances = rarityChances(lootQuality(context), content);

  const pityForced = content.config.pityVictories > 0 && context.pity >= content.config.pityVictories;
  const floorRank = Math.max(
    context.firstClear ? rarityIndex(content.config.firstClear.minRarity) : 0,
    pityForced ? RARITIES.length - 1 : 0,
  );

  const items: ItemInstance[] = [];
  for (let i = 0; i < count && bases.length > 0; i += 1) {
    const base = bases[Math.floor(context.rng() * bases.length)] as ItemBaseDef;
    const rolled = pickRarity(context.rng, chances);
    const rank = Math.max(rarityIndex(rolled), i === 0 ? floorRank : 0);
    const rarity = index.rarities.get(RARITIES[rank] ?? 'comum');
    if (rarity) items.push(rollItem(base, rarity, context.stage.level, context, content));
  }
  const legendary = items.some((item) => item.rarity === 'lendario');
  return { items, pity: legendary ? 0 : context.pity + 1 };
}

/** A copy with the affix at `index` rolled again. The primary (0) and unknown indexes are left alone. */
export function rerollAffix(item: ItemInstance, index: number, rng: () => number, content: HackathonContent): ItemInstance {
  const base = indexOf(content).items.get(item.base);
  const rarity = indexOf(content).rarities.get(item.rarity);
  if (!base || !rarity || index < 1 || index >= item.affixes.length) return { ...item, affixes: [...item.affixes] };
  const others = item.affixes.filter((_, i) => i !== index);
  const candidates = base.pool.filter((def) => !others.some((a) => sameAffix(a, def)));
  const def = candidates[Math.floor(rng() * candidates.length)];
  if (!def) return { ...item, affixes: [...item.affixes] };
  const affixes = [...item.affixes];
  affixes[index] = rollAffix(def, rarity, item.level, rng, content);
  return { ...item, affixes, quality: averageQuality(affixes), rerolls: item.rerolls + 1 };
}

/** Base price, doubled by each reroll of the same item. */
export function rerollCost(item: ItemInstance, content: HackathonContent): number {
  let cost = content.config.reroll.baseCommits;
  for (let i = 0; i < Math.min(item.rerolls, 30); i += 1) cost *= 2;
  return cost;
}

export function recycleValue(item: ItemInstance, content: HackathonContent): number {
  return indexOf(content).rarities.get(item.rarity)?.recycleCommits ?? 0;
}

/** Rarity first, then quality, then level (levels stay below 100). */
export function itemScore(item: ItemInstance): number {
  return rarityIndex(item.rarity) * 1_000_000 + Math.round(item.quality * 10) * 100 + Math.min(99, item.level);
}
