import { LAB_RARITIES, LAB_SLOTS } from '../../content/labTypes';
import type { LabItemBase, LabRarity } from '../../content/labTypes';
import type { GameContent } from '../../content/types';
import type { GameState } from '../state';
import { labTotals } from './effects';
import { enterNextPhase, maxIntegrityFor, spawnPhase } from './phase';
import { makeOffers } from './rewards';
import { createLabCounters, createLabRun, createLabState, labIndex } from './state';
import type { LabAffix, LabBreakReason, LabCounters, LabItem, LabMob, LabOffer, LabRun, LabRunStatus, LabState, LabTurma } from './types';

// Tolerant readers of the `lab` part of a save: anything missing or malformed falls back to a default, ids that no
// longer exist are dropped, and every number is clamped to what the game could have produced.

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function num(value: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

const int = (value: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER) => Math.floor(num(value, fallback, min, max));

const RUN_STATUSES: LabRunStatus[] = ['fighting', 'reward', 'equip', 'broken'];
const BREAK_REASONS: LabBreakReason[] = ['timer', 'integrity'];
const MAX_PHASE = 100_000;
const MAX_MOBS = 40;
const MAX_CLEAR_LOG = 2000;
const MAX_STACKS = 99;

export function readLabItem(value: unknown, content: GameContent): LabItem | null {
  if (!isRecord(value)) return null;
  const index = labIndex(content);
  const base: LabItemBase | undefined = typeof value.base === 'string' ? index.bases.get(value.base) : undefined;
  const rarity: LabRarity | undefined = LAB_RARITIES.find((id) => id === value.rarity);
  const rarityDef = rarity ? index.rarities.get(rarity) : undefined;
  if (!base || !rarity || !rarityDef) return null;

  const affixes: LabAffix[] = [];
  if (base.affixes) {
    const raw = Array.isArray(value.affixes) ? value.affixes : [];
    for (const entry of raw) {
      if (affixes.length >= 1 + rarityDef.extraAffixes) break;
      if (!isRecord(entry) || (entry.op !== 'add' && entry.op !== 'pct')) continue;
      const def = [base.primary, ...base.pool].find((candidate) => candidate.target === entry.target && candidate.op === entry.op);
      if (!def || affixes.some((affix) => affix.target === def.target && affix.op === def.op)) continue;
      // Between the lowest and the highest roll the rarity allows; a forged number cannot go past it.
      const min = def.min * rarityDef.valueMultiplier;
      const max = def.max * rarityDef.valueMultiplier;
      affixes.push({ target: def.target, op: def.op, value: num(entry.value, min, min, max) });
    }
    const primary = affixes[0];
    if (!primary || primary.target !== base.primary.target || primary.op !== base.primary.op) return null;
  }

  return {
    uid: int(value.uid, 0),
    base: base.id,
    rarity,
    level: int(value.level, 1, 1, content.lab.items.maxLevel),
    affixes,
    rerolls: int(value.rerolls, 0, 0, 1000),
  };
}

function readOffers(value: unknown, content: GameContent): LabOffer[] {
  const offers: LabOffer[] = [];
  if (!Array.isArray(value)) return offers;
  const index = labIndex(content);
  for (const entry of value) {
    if (offers.length >= content.lab.rewards.maxOptions) break;
    if (!isRecord(entry)) continue;
    if (entry.kind === 'item') {
      const item = readLabItem(entry.item, content);
      if (item) offers.push({ kind: 'item', item });
    } else if (entry.kind === 'buff') {
      if (typeof entry.buff === 'string' && index.buffs.has(entry.buff)) offers.push({ kind: 'buff', buff: entry.buff });
    } else if (entry.kind === 'commits') {
      offers.push({ kind: 'commits', amount: int(entry.amount, 1, 1, 1_000_000) });
    } else if (entry.kind === 'repair') {
      offers.push({ kind: 'repair', share: num(entry.share, 0.25, 0, 1) });
    }
  }
  return offers;
}

function readMobs(value: unknown, content: GameContent): LabMob[] {
  const mobs: LabMob[] = [];
  if (!Array.isArray(value)) return mobs;
  const index = labIndex(content);
  for (const entry of value) {
    if (mobs.length >= MAX_MOBS) break;
    if (!isRecord(entry) || typeof entry.def !== 'string' || !index.enemies.has(entry.def)) continue;
    const maxHp = num(entry.maxHp, 0, 0, 1e300);
    const hp = num(entry.hp, maxHp, 0, maxHp);
    if (hp > 0) mobs.push({ uid: int(entry.uid, 0), def: entry.def, hp, maxHp });
  }
  return mobs;
}

function readRun(value: unknown, content: GameContent): LabRun | null {
  if (!isRecord(value)) return null;
  const status = RUN_STATUSES.find((entry) => entry === value.status);
  if (!status) return null;
  const index = labIndex(content);
  const cfg = content.lab.run;
  const run = createLabRun(int(value.seed, 0, 0, 4294967295), cfg.startIntegrity);

  run.status = status;
  run.phase = int(value.phase, 1, 1, MAX_PHASE);
  run.t = num(value.t, 0, 0);
  run.phaseTime = num(value.phaseTime, 0, 0);
  run.carry = num(value.carry, 0, 0, cfg.stepSeconds);
  run.maxIntegrity = num(value.maxIntegrity, cfg.startIntegrity, cfg.minIntegrity, 1_000_000);
  run.integrity = num(value.integrity, run.maxIntegrity, 0, run.maxIntegrity);
  run.mobs = readMobs(value.mobs, content);
  run.mobSeq = Math.max(int(value.mobSeq, 0), ...run.mobs.map((mob) => mob.uid));
  run.waveHp = num(value.waveHp, 0, 0, 1e300);
  run.bossLeft = value.bossLeft === null || value.bossLeft === undefined ? null : num(value.bossLeft, 0, 0, 1000);
  run.nextCharge = num(value.nextCharge, 0, 0);
  run.offers = readOffers(value.offers, content);
  run.pending = readLabItem(value.pending, content);
  if (isRecord(value.buffs)) {
    for (const id in value.buffs) {
      const count = int(value.buffs[id], 0, 0, MAX_STACKS);
      if (count > 0 && index.buffs.has(id)) run.buffs[id] = count;
    }
  }
  if (Array.isArray(value.clickTimes)) {
    run.clickTimes = value.clickTimes
      .filter((at): at is number => typeof at === 'number' && Number.isFinite(at) && at >= 0)
      .slice(-cfg.click.perWindow);
  }
  run.windUsed = int(value.windUsed, 0, 0, 100);
  run.cleared = int(value.cleared, 0, 0, MAX_PHASE);
  run.bosses = int(value.bosses, 0, 0, run.cleared);
  if (Array.isArray(value.clearLog)) {
    run.clearLog = value.clearLog.filter((at): at is number => typeof at === 'number' && Number.isFinite(at) && at >= 0).slice(0, MAX_CLEAR_LOG);
  }
  run.brokenBy = BREAK_REASONS.find((reason) => reason === value.brokenBy) ?? null;
  run.paid = int(value.paid, 0, 0, 1e9);
  if (status === 'broken' && !run.brokenBy) run.brokenBy = 'integrity';
  return run;
}

function readCounters(value: unknown): LabCounters {
  const counters = createLabCounters();
  if (!isRecord(value)) return counters;
  for (const key of Object.keys(counters) as (keyof LabCounters)[]) counters[key] = int(value[key], 0, 0, 1e12);
  return counters;
}

function readTurma(value: unknown, content: GameContent): LabTurma {
  const turma: LabTurma = { run: null, equipped: {}, nextUid: 1 };
  if (!isRecord(value)) return turma;
  turma.run = readRun(value.run, content);
  let maxUid = 0;
  if (isRecord(value.equipped)) {
    for (const slot of LAB_SLOTS) {
      const item = readLabItem(value.equipped[slot], content);
      // An item sits in the slot of its base only.
      if (item && labIndex(content).bases.get(item.base)?.slot === slot) {
        turma.equipped[slot] = item;
        maxUid = Math.max(maxUid, item.uid);
      }
    }
  }
  if (turma.run?.pending) maxUid = Math.max(maxUid, turma.run.pending.uid);
  turma.nextUid = Math.max(int(value.nextUid, 1, 1), maxUid + 1);
  return turma;
}

/** The `lab` object of a save. A save without it (older ones) gets a locked, empty lab. */
export function readLab(value: unknown, content: GameContent): LabState {
  const lab = createLabState();
  if (!isRecord(value)) return lab;
  lab.unlocked = value.unlocked === true;
  lab.open = false;
  lab.commits = int(value.commits, 0, 0, 1e12);
  if (isRecord(value.tree)) {
    for (const def of content.lab.tree) {
      const level = int(value.tree[def.id], 0, 0, def.maxLevel);
      if (level > 0) lab.tree[def.id] = level;
    }
  }
  lab.bestPhase = int(value.bestPhase, 0, 0, MAX_PHASE);
  lab.counters = readCounters(value.counters);
  lab.turma = readTurma(value.turma, content);
  return lab;
}

/**
 * Makes the run of a freshly read save consistent with its status, so a half-written or hand-edited save cannot leave
 * the player stuck: a fight with no mobs gets its wave, a reward with no options gets them, an item waiting for a
 * decision that is not there moves on. Also follows the maximum integrity of what the player owns.
 */
export function settleLabAfterLoad(state: GameState, content: GameContent): void {
  const { lab } = state;
  const run = lab.turma.run;
  if (!run) return;
  if (!lab.unlocked) {
    // A run cannot exist in a lab that was never unlocked.
    lab.turma = { run: null, equipped: {}, nextUid: 1 };
    return;
  }
  lab.bestPhase = Math.max(lab.bestPhase, run.phase);
  const totals = labTotals(state, content);
  if (run.status === 'broken') return;
  // The maximum is what the player owns says it is; a load never heals.
  run.maxIntegrity = maxIntegrityFor(content, totals);
  run.integrity = Math.min(Math.max(1, run.integrity), run.maxIntegrity);

  if (run.status === 'fighting' && run.mobs.length === 0) spawnPhase(state, content, totals);
  else if (run.status === 'reward' && run.offers.length === 0) run.offers = makeOffers(state, content, totals);
  else if (run.status === 'equip' && !run.pending) enterNextPhase(state, content);
  if (run.status !== 'equip') run.pending = null;
}
