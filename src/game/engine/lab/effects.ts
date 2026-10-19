import { LAB_EFFECT_KEYS } from '../../content/labTypes';
import type { LabBonus, LabConversion, LabEffectKey, LabEffects, LabModifier } from '../../content/labTypes';
import type { Effect, GameContent, StatKey } from '../../content/types';
import type { GameState } from '../state';
import { affixValue, hasUnique, itemBase, itemPower } from './items';
import { LAB_SLOTS } from '../../content/labTypes';
import { labIndex } from './state';
import type { LabItem } from './types';

/** Every lab effect summed over items, sets, run buffs and the tree. */
export type LabEffectTotals = Record<LabEffectKey, number>;

export interface LabTotals {
  /** Sum of the power of the equipped items. */
  power: number;
  lab: LabEffectTotals;
  /** What the lab adds to each clicker stat, after the tree's multiplier and the caps. */
  clicker: Map<StatKey, number>;
}

export function emptyEffects(): LabEffectTotals {
  const totals = {} as LabEffectTotals;
  for (const key of LAB_EFFECT_KEYS) totals[key] = 0;
  return totals;
}

function addEffects(into: LabEffectTotals, effects: LabEffects | undefined, times = 1): void {
  if (!effects) return;
  for (const key of LAB_EFFECT_KEYS) {
    const value = effects[key];
    if (value !== undefined) into[key] += value * times;
  }
}

function addClicker(into: Map<StatKey, number>, stat: StatKey, value: number): void {
  into.set(stat, (into.get(stat) ?? 0) + value);
}

function applyConversion(totals: LabTotals, conversion: LabConversion | undefined, value: number): void {
  if (!conversion) return;
  for (const part of conversion.clicker) addClicker(totals.clicker, part.stat, part.per * value);
  for (const key of LAB_EFFECT_KEYS) {
    const per = conversion.lab[key];
    if (per !== undefined) totals.lab[key] += per * value;
  }
}

function applyBonus(totals: LabTotals, bonus: LabBonus | undefined, times = 1): void {
  if (!bonus) return;
  for (const part of bonus.clicker ?? []) addClicker(totals.clicker, part.stat, part.value * times);
  addEffects(totals.lab, bonus.lab, times);
}

function applyModifier(totals: LabTotals, content: GameContent, modifier: LabModifier, times = 1): void {
  applyConversion(totals, content.lab.affixes[modifier.target]?.[modifier.op], modifier.value * times);
}

function applyUnique(totals: LabTotals, content: GameContent, item: LabItem): void {
  const unique = itemBase(content, item)?.unique;
  if (!unique) return;
  switch (unique.kind) {
    case 'modifiers':
      for (const modifier of unique.modifiers) applyModifier(totals, content, modifier);
      break;
    case 'skill':
      applyBonus(totals, content.lab.skillBonuses[unique.skill]);
      break;
    case 'secondWind':
      applyBonus(totals, content.lab.secondWindBonus);
      break;
    case 'critSplash':
      applyConversion(totals, content.lab.critSplash, unique.chance);
      break;
  }
}

/** Number of equipped pieces of each set. */
export function setPieces(state: GameState, content: GameContent): Map<string, number> {
  const pieces = new Map<string, number>();
  for (const item of Object.values(state.lab.turma.equipped)) {
    const set = itemBase(content, item)?.set;
    if (set) pieces.set(set, (pieces.get(set) ?? 0) + 1);
  }
  return pieces;
}

/** What a recycled item's Commits are multiplied by: the Commits bonus and the recycling bonus of the tree. */
export function recycleMultiplier(totals: LabTotals): number {
  return (1 + Math.max(0, totals.lab.commits)) * (1 + Math.max(0, totals.lab.recycleBonus));
}

const EMPTY: LabEffectTotals = emptyEffects();

/**
 * Everything the lab gets from what the player owns: the power of the equipped items, the lab effects of items, sets,
 * run buffs and the tree, and the (capped) clicker bonuses. The clicker part is what computeStats reads.
 */
export function labTotals(state: GameState, content: GameContent): LabTotals {
  const { lab } = state;
  const totals: LabTotals = { power: 0, lab: emptyEffects(), clicker: new Map() };
  if (!lab.unlocked) return { ...totals, lab: EMPTY };
  const index = labIndex(content);

  for (const item of Object.values(lab.turma.equipped)) {
    totals.power += itemPower(content, item);
    addEffects(totals.lab, itemBase(content, item)?.effects);
    for (const affix of item.affixes) applyConversion(totals, content.lab.affixes[affix.target]?.[affix.op], affixValue(content, item, affix));
    if (hasUnique(item)) applyUnique(totals, content, item);
  }

  for (const [setId, count] of setPieces(state, content)) {
    const set = content.lab.sets.find((entry) => entry.id === setId);
    if (!set) continue;
    for (const bonus of set.bonuses) {
      if (count >= bonus.pieces) for (const modifier of bonus.modifiers) applyModifier(totals, content, modifier);
    }
  }

  const buffs = lab.turma.run?.buffs;
  if (buffs) {
    for (const id in buffs) {
      const def = index.buffs.get(id);
      const count = buffs[id] ?? 0;
      if (!def || count <= 0) continue;
      for (const modifier of def.modifiers) applyModifier(totals, content, modifier, count);
      addEffects(totals.lab, def.lab, count);
    }
  }

  for (const id in lab.tree) {
    const def = index.nodes.get(id);
    const level = lab.tree[id] ?? 0;
    if (!def || level <= 0) continue;
    addEffects(totals.lab, def.effects, level);
    for (const part of def.clicker ?? []) addClicker(totals.clicker, part.stat, part.per * level);
  }

  // Damage that depends on the build: the empty slots (early help) and the legendaries (late reward).
  const equipped = Object.values(lab.turma.equipped);
  const empty = LAB_SLOTS.length - equipped.length;
  const legendaries = equipped.filter((item) => hasUnique(item)).length;
  totals.lab.damage += totals.lab.emptySlotDamage * Math.max(0, empty) + totals.lab.legendaryDamage * legendaries;

  // The lab's bonuses to the clicker grow with the tree and stop at the caps, whatever the items and buffs add up to.
  const factor = 1 + Math.max(0, totals.lab.clicker);
  for (const [stat, value] of totals.clicker) {
    const cap = content.lab.caps[stat];
    const scaled = value * factor;
    totals.clicker.set(stat, cap === undefined ? scaled : Math.sign(scaled) * Math.min(Math.abs(scaled), cap));
  }
  return totals;
}

/** The lab's contribution to the clicker, as 'add' effects for computeStats. Empty until the lab is unlocked. */
export function labClickerEffects(state: GameState, content: GameContent): Effect[] {
  if (!state.lab.unlocked) return [];
  const effects: Effect[] = [];
  for (const [stat, value] of labTotals(state, content).clicker) {
    if (value !== 0) effects.push({ stat, op: 'add', value });
  }
  return effects;
}
