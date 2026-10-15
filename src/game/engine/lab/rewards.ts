import type { Stream } from '../../../hackathon/engine/rng';
import type { LabItemBase, LabRarity } from '../../content/labTypes';
import type { GameContent } from '../../content/types';
import type { Emit } from '../../store/types';
import type { GameState } from '../state';
import { labTotals } from './effects';
import type { LabTotals } from './effects';
import { atLeast, itemSlot, recycleValue, rollItem, rollRarity } from './items';
import { enterNextPhase, gainCommits, isBossPhase, syncIntegrity } from './phase';
import { LAB_STREAM, labIndex, labStream } from './state';
import type { LabItem, LabOffer } from './types';

type OfferKind = LabOffer['kind'];

/** Item level of a drop of this phase. */
export function dropLevel(content: GameContent, phase: number, boss: boolean): number {
  const { dropLevelEvery, bossLevelBonus, maxLevel } = content.lab.items;
  return Math.min(maxLevel, 1 + Math.floor((Math.max(1, phase) - 1) / dropLevelEvery) + (boss ? bossLevelBonus : 0));
}

/** Loot quality (rarity shift, in percent) of the rewards of a phase: luck from items, buffs and the tree, plus the depth. */
export function lootQuality(content: GameContent, totals: LabTotals, phase: number): number {
  const { phaseQuality, maxQuality } = content.lab.rewards;
  return Math.min(maxQuality, Math.max(0, totals.lab.luck) + phaseQuality * Math.max(0, phase - 1));
}

function pickWeighted<T>(stream: Stream, entries: { value: T; weight: number }[]): T | undefined {
  const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (total <= 0) return entries[0]?.value;
  let roll = stream() * total;
  for (const entry of entries) {
    roll -= Math.max(0, entry.weight);
    if (roll < 0) return entry.value;
  }
  return entries[entries.length - 1]?.value;
}

function offerItem(
  state: GameState,
  content: GameContent,
  stream: Stream,
  phase: number,
  boss: boolean,
  quality: number,
  floor: LabRarity | null,
  taken: Set<string>,
): LabItem | null {
  const { equipped } = state.lab.turma;
  const all = labIndex(content).droppable;
  const fresh = all.filter((base) => !taken.has(base.id));
  const pool: LabItemBase[] = fresh.length > 0 ? fresh : all;
  const base = pickWeighted(
    stream,
    pool.map((entry) => ({ value: entry, weight: equipped[entry.slot] ? 1 : content.lab.rewards.emptySlotWeight })),
  );
  if (!base) return null;
  taken.add(base.id);
  const rolled = rollRarity(content, quality, stream);
  const rarity = floor ? atLeast(content, rolled, floor) : rolled;
  return rollItem(content, base, rarity, dropLevel(content, phase, boss), stream);
}

/** How many options this reward shows: 3, +1 on the first reward with the tree, +1 by the chance luck gives. */
function optionCount(state: GameState, content: GameContent, totals: LabTotals, stream: Stream): number {
  const run = state.lab.turma.run;
  const { options, maxOptions } = content.lab.rewards;
  let count = options;
  if (run && run.cleared === 1) count += Math.max(0, Math.floor(totals.lab.firstOptions));
  // Always drawn, so the rest of the stream does not depend on the chance.
  const roll = stream() * 100;
  if (roll < totals.lab.extraOption) count += 1;
  return Math.min(maxOptions, count);
}

/**
 * The options after clearing the current phase. The first one is always an item; the rest are drawn by weight from
 * items, run buffs, Commits and an integrity repair. A boss reward is made of better items. Everything comes from the
 * run's seed and the phase, plus what the player owns (luck, the slots that are empty, how hurt the monitor is).
 */
export function makeOffers(state: GameState, content: GameContent, totals: LabTotals): LabOffer[] {
  const run = state.lab.turma.run;
  if (!run) return [];
  const cfg = content.lab.rewards;
  const phase = run.phase;
  const boss = isBossPhase(content, phase);
  const stream = labStream(run.seed, LAB_STREAM.offers, phase);
  const count = optionCount(state, content, totals, stream);
  const quality = lootQuality(content, totals, phase);

  const offers: LabOffer[] = [];
  const takenBases = new Set<string>();
  const usedBuffs = new Set<string>();
  let hasCommits = false;
  let hasRepair = false;
  const hurt = run.integrity < run.maxIntegrity / 2;

  for (let i = 0; i < count; i += 1) {
    let kind: OfferKind = 'item';
    if (i > 0 && !(boss && i < cfg.bossItems)) {
      const freeBuffs = content.lab.buffs.filter((buff) => !usedBuffs.has(buff.id));
      kind =
        pickWeighted<OfferKind>(stream, [
          { value: 'item', weight: cfg.weights.item },
          { value: 'buff', weight: freeBuffs.length > 0 ? cfg.weights.buff : 0 },
          { value: 'commits', weight: hasCommits ? 0 : cfg.weights.commits },
          { value: 'repair', weight: hasRepair ? 0 : cfg.weights.repair * (hurt ? cfg.repairWhenHurt : 1) },
        ]) ?? 'item';
    }

    if (kind === 'buff') {
      const free = content.lab.buffs.filter((buff) => !usedBuffs.has(buff.id));
      const buff = free[Math.floor(stream() * free.length)];
      if (buff) {
        usedBuffs.add(buff.id);
        offers.push({ kind: 'buff', buff: buff.id });
        continue;
      }
      kind = 'item';
    }
    if (kind === 'commits') {
      hasCommits = true;
      const amount = cfg.commitsBase * (1 + cfg.commitsPerPhase * (phase - 1)) * (1 + Math.max(0, totals.lab.commits));
      offers.push({ kind: 'commits', amount: Math.max(1, Math.round(amount)) });
      continue;
    }
    if (kind === 'repair') {
      hasRepair = true;
      offers.push({ kind: 'repair', share: boss ? cfg.bossRepairShare : cfg.repairShare });
      continue;
    }
    const floor = boss ? (i === 0 ? cfg.bossRarityFloor : i < cfg.bossItems ? cfg.bossSecondFloor : null) : null;
    const item = offerItem(state, content, stream, phase, boss, quality, floor, takenBases);
    if (item) offers.push({ kind: 'item', item });
  }
  return offers;
}

/** The item takes the slot of its base: the one it replaces, if any, is returned. */
function equip(state: GameState, content: GameContent, item: LabItem): LabItem | null {
  const slot = itemSlot(content, item);
  if (!slot) return null;
  const previous = state.lab.turma.equipped[slot] ?? null;
  state.lab.turma.equipped[slot] = item;
  return previous;
}

/** Commits a recycled item pays, with the tree's and items' bonus. */
function recycleCommits(state: GameState, content: GameContent, item: LabItem): number {
  const bonus = 1 + Math.max(0, labTotals(state, content).lab.commits);
  return Math.floor(recycleValue(content, item) * bonus);
}

/** Picks the option at `index` of the reward on screen. An item for an occupied slot waits for equipLabPending / recycleLabPending. */
export function chooseLabReward(state: GameState, content: GameContent, index: number, emit: Emit): boolean {
  const { lab } = state;
  const run = lab.turma.run;
  if (!run || run.status !== 'reward') return false;
  const offer = run.offers[Math.floor(index)];
  if (!offer) return false;

  switch (offer.kind) {
    case 'item': {
      const slot = itemSlot(content, offer.item);
      if (!slot) return false;
      const item: LabItem = { ...offer.item, affixes: offer.item.affixes.map((affix) => ({ ...affix })), uid: lab.turma.nextUid };
      lab.turma.nextUid += 1;
      lab.counters.itemsFound += 1;
      if (lab.turma.equipped[slot]) {
        run.pending = item;
        run.status = 'equip';
        run.offers = [];
        emit({ type: 'labItemGained', item: item.base, rarity: item.rarity, equipped: false });
        return true;
      }
      equip(state, content, item);
      emit({ type: 'labItemGained', item: item.base, rarity: item.rarity, equipped: true });
      break;
    }
    case 'buff':
      if (!labIndex(content).buffs.has(offer.buff)) return false;
      run.buffs[offer.buff] = (run.buffs[offer.buff] ?? 0) + 1;
      syncIntegrity(run, content, labTotals(state, content));
      break;
    case 'commits':
      gainCommits(state, offer.amount);
      break;
    case 'repair':
      run.integrity = Math.min(run.maxIntegrity, run.integrity + run.maxIntegrity * offer.share);
      break;
  }
  enterNextPhase(state, content);
  return true;
}

/** Settles the item waiting for a decision: equip it (the one in the slot is recycled) or recycle it. */
export function resolveLabPending(state: GameState, content: GameContent, equipIt: boolean, emit: Emit): boolean {
  const { lab } = state;
  const run = lab.turma.run;
  if (!run || run.status !== 'equip' || !run.pending) return false;
  const pending = run.pending;
  if (equipIt) {
    const previous = equip(state, content, pending);
    if (previous) {
      gainCommits(state, recycleCommits(state, content, previous));
      lab.counters.itemsRecycled += 1;
      emit({ type: 'labItemRecycled', item: previous.base, rarity: previous.rarity });
    }
  } else {
    gainCommits(state, recycleCommits(state, content, pending));
    lab.counters.itemsRecycled += 1;
    emit({ type: 'labItemRecycled', item: pending.base, rarity: pending.rarity });
  }
  run.pending = null;
  enterNextPhase(state, content);
  return true;
}
