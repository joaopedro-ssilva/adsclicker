/**
 * View models of the Laboratório for the UI: the slot in the classroom, the monitor, the bench (items), the rewards
 * and the tree. Pure builders over (state, content); text is pt-BR and ready to show.
 */
import { LAB_EFFECT_KEYS, LAB_SLOTS } from '../../content/labTypes';
import type { LabConversion, LabEffectKey, LabNodeDef, LabRarity, LabSlot } from '../../content/labTypes';
import type { GameContent, StatKey } from '../../content/types';
import type { Decimal } from '../decimal';
import type { GameState } from '../state';
import { labCanUnlock, labRunAvailable, labSlotVisible } from './access';
import type { LabAvailability } from './access';
import { levelUpCost, rerollCost } from './costs';
import { labTotals, setPieces } from './effects';
import type { LabTotals } from './effects';
import { affixValue, hasUnique, itemBase, itemPower, recycleValue } from './items';
import { drainPerSecond, autoDps, clickDamage, clickShareCap } from './run';
import { isBossPhase, runCommits } from './phase';
import { labIndex } from './state';
import { labNodeAvailable, labNodeCost, labNodeLevel, labTreeSpent } from './tree';
import type { LabItem, LabOffer, LabRunStatus } from './types';

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

const round1 = (value: number) => Math.round(value * 10) / 10;
const number = (value: number) => String(round1(value)).replace('.', ',');
const signed = (value: number) => `${value < 0 ? '-' : '+'}${number(Math.abs(value))}`;
const percent = (fraction: number) => `${signed(fraction * 100)}%`;

/** Stats the clicker reads as plain numbers instead of shares. */
const PLAIN_STATS: StatKey[] = ['comboMax'];

function statText(stat: StatKey, value: number): string {
  return PLAIN_STATS.includes(stat) ? signed(value) : percent(value);
}

const LAB_PLAIN: LabEffectKey[] = ['integrityFlat', 'luck', 'firstOptions', 'secondWind', 'startSetup'];

function labEffectText(key: LabEffectKey, value: number): string {
  if (key === 'bossTime') return `${signed(value)} s`;
  if (key === 'extraOption') return `${signed(value)}%`;
  if (key === 'startSetup') return 'sim';
  return LAB_PLAIN.includes(key) ? signed(value) : percent(value);
}

export interface LabLine {
  label: string;
  text: string;
}

/** The lines (clicker first, then the lab) one conversion gives for `value` units. */
function conversionLines(content: GameContent, conversion: LabConversion | undefined, value: number): LabLine[] {
  if (!conversion) return [];
  const lines: LabLine[] = [];
  for (const part of conversion.clicker) {
    lines.push({ label: content.lab.labels.stats[part.stat] ?? part.stat, text: statText(part.stat, part.per * value) });
  }
  for (const key of LAB_EFFECT_KEYS) {
    const per = conversion.lab[key];
    if (per !== undefined) lines.push({ label: content.lab.labels.effects[key], text: labEffectText(key, per * value) });
  }
  return lines;
}

// ---------------------------------------------------------------------------
// The slot in the classroom
// ---------------------------------------------------------------------------

export interface LabSlotView {
  /** Pablo is hired: the 9th slot shows. */
  visible: boolean;
  unlocked: boolean;
  canUnlock: boolean;
  /** Diplomas the unlock costs, and the ones in hand. */
  cost: number;
  diplomas: number;
  affordable: boolean;
  available: LabAvailability;
  /** The lab screen is open. */
  open: boolean;
  /** A run exists in this turma. */
  hasRun: boolean;
  bestPhase: number;
  commits: number;
}

export function labSlotView(state: GameState, content: GameContent): LabSlotView {
  const { lab } = state;
  return {
    visible: labSlotVisible(state, content),
    unlocked: lab.unlocked,
    canUnlock: labCanUnlock(state, content),
    cost: content.lab.unlock.diplomas,
    diplomas: state.diplomas,
    affordable: state.diplomas >= content.lab.unlock.diplomas,
    available: labRunAvailable(state, content),
    open: lab.open,
    hasRun: lab.turma.run !== null,
    bestPhase: lab.bestPhase,
    commits: lab.commits,
  };
}

// ---------------------------------------------------------------------------
// The monitor (the fight)
// ---------------------------------------------------------------------------

export interface LabMobView {
  uid: number;
  id: string;
  name: string;
  emoji: string;
  asset: string;
  boss: boolean;
  hp: number;
  maxHp: number;
  /** 0..1 of the HP left. */
  fraction: number;
}

export interface LabMonitorView {
  unlocked: boolean;
  available: LabAvailability;
  /** The run can be started now. */
  canStart: boolean;
  hasRun: boolean;
  status: LabRunStatus | 'none';
  open: boolean;
  phase: number;
  boss: boolean;
  integrity: number;
  maxIntegrity: number;
  /** 0..1 */
  integrityFraction: number;
  mobs: LabMobView[];
  /** 0..1 of the wave's HP already taken down. */
  waveProgress: number;
  /** Seconds left on the boss timer and the whole timer, or null in a regular phase. */
  bossLeft: number | null;
  bossTotal: number | null;
  /** Damage per second from the equipped items, and what a click deals. */
  autoDps: number;
  clickDamage: number;
  /** Clicks that count per second at most, and the most extra damage per second they can add. */
  clicksPerSecond: number;
  clickDpsCap: number;
  /** Integrity the living mobs drain per second. */
  drain: number;
  cleared: number;
  bosses: number;
  /** Seconds played in the run. */
  seconds: number;
  bestPhase: number;
  brokenBy: 'timer' | 'integrity' | null;
  /** Commits the run pays if it ends now (or paid, once broken). */
  commits: number;
  /** Commits in hand. */
  wallet: number;
}

export function labMonitorView(state: GameState, content: GameContent): LabMonitorView {
  const { lab } = state;
  const run = lab.turma.run;
  const available = labRunAvailable(state, content);
  const totals = labTotals(state, content);
  const index = labIndex(content);
  const boss = run ? run.bossLeft !== null || (run.status === 'fighting' && isBossPhase(content, run.phase)) : false;
  const dps = autoDps(totals, boss);
  const { click } = content.lab.run;

  const mobs: LabMobView[] = (run?.mobs ?? []).map((mob) => {
    const def = index.enemies.get(mob.def);
    return {
      uid: mob.uid,
      id: mob.def,
      name: def?.name ?? mob.def,
      emoji: def?.emoji ?? '?',
      asset: def?.asset ?? '',
      boss: def?.boss ?? false,
      hp: mob.hp,
      maxHp: mob.maxHp,
      fraction: mob.maxHp > 0 ? Math.min(1, Math.max(0, mob.hp / mob.maxHp)) : 0,
    };
  });
  const hpLeft = mobs.reduce((sum, mob) => sum + mob.hp, 0);

  return {
    unlocked: lab.unlocked,
    available,
    canStart: available.ok && run === null,
    hasRun: run !== null,
    status: run ? run.status : 'none',
    open: lab.open,
    phase: run?.phase ?? 0,
    boss,
    integrity: run?.integrity ?? 0,
    maxIntegrity: run?.maxIntegrity ?? 0,
    integrityFraction: run && run.maxIntegrity > 0 ? Math.min(1, Math.max(0, run.integrity / run.maxIntegrity)) : 0,
    mobs,
    waveProgress: run && run.waveHp > 0 ? Math.min(1, Math.max(0, 1 - hpLeft / run.waveHp)) : 0,
    bossLeft: run?.bossLeft ?? null,
    bossTotal: boss ? content.lab.run.bossTimerSeconds + totals.lab.bossTime : null,
    autoDps: dps,
    clickDamage: clickDamage(content, totals, boss),
    clicksPerSecond: (click.perWindow * 1000) / click.windowMs,
    clickDpsCap: dps * clickShareCap(content),
    drain: run && run.status === 'fighting' ? drainPerSecond(run, content, totals) : 0,
    cleared: run?.cleared ?? 0,
    bosses: run?.bosses ?? 0,
    seconds: run?.t ?? 0,
    bestPhase: lab.bestPhase,
    brokenBy: run?.brokenBy ?? null,
    commits: run ? (run.status === 'broken' ? run.paid : runCommits(content, run, totals)) : 0,
    wallet: lab.commits,
  };
}

// ---------------------------------------------------------------------------
// Items: the bench
// ---------------------------------------------------------------------------

export interface LabAffixView {
  index: number;
  /** What the affix gives right now (clicker stats first, then lab effects). */
  lines: LabLine[];
  /** ADScoins to roll it again, and whether the player has them. */
  rerollCost: Decimal;
  canReroll: boolean;
}

export interface LabItemView {
  uid: number;
  slot: LabSlot;
  base: string;
  name: string;
  emoji: string;
  asset: string;
  description: string;
  rarity: LabRarity;
  rarityName: string;
  level: number;
  maxLevel: number;
  /** Damage per second in the lab, and at the next level. */
  power: number;
  nextPower: number | null;
  affixes: LabAffixView[];
  /** The legendary effect: its text, and whether this item has it on (only legendary ones do). */
  unique: { description: string; active: boolean } | null;
  set: { id: string; name: string; pieces: number } | null;
  /** Commits it pays if recycled. */
  recycleValue: number;
  /** ADScoins for the next level (null at the top level) and whether the player has them. */
  levelUpCost: Decimal | null;
  canLevelUp: boolean;
  rerolls: number;
}

/** The view of an item; `owned` items can be raised and rerolled, offered ones only show their price. */
export function labItemView(state: GameState, content: GameContent, item: LabItem, owned: boolean): LabItemView | null {
  const base = itemBase(content, item);
  if (!base) return null;
  const rarity = labIndex(content).rarities.get(item.rarity);
  const cost = levelUpCost(content, item);
  const reroll = rerollCost(content, item);
  const pieces = base.set ? (setPieces(state, content).get(base.set) ?? 0) : 0;
  const set = base.set ? content.lab.sets.find((entry) => entry.id === base.set) : undefined;
  const nextLevel = { ...item, level: item.level + 1 };
  return {
    uid: item.uid,
    slot: base.slot,
    base: base.id,
    name: base.name,
    emoji: base.emoji,
    asset: base.asset,
    description: base.description,
    rarity: item.rarity,
    rarityName: rarity?.name ?? item.rarity,
    level: item.level,
    maxLevel: content.lab.items.maxLevel,
    power: itemPower(content, item),
    nextPower: cost ? itemPower(content, nextLevel) : null,
    affixes: item.affixes.map((affix, index) => ({
      index,
      lines: conversionLines(content, content.lab.affixes[affix.target]?.[affix.op], affixValue(content, item, affix)),
      rerollCost: reroll,
      canReroll: owned && state.lab.unlocked && state.coins.gte(reroll),
    })),
    unique: base.unique.description ? { description: base.unique.description, active: hasUnique(item) } : null,
    set: set ? { id: set.id, name: set.name, pieces } : null,
    recycleValue: recycleValue(content, item),
    levelUpCost: cost,
    canLevelUp: owned && state.lab.unlocked && cost !== null && state.coins.gte(cost),
    rerolls: item.rerolls,
  };
}

export interface LabBenchView {
  unlocked: boolean;
  available: LabAvailability;
  slots: { slot: LabSlot; item: LabItemView | null }[];
  /** Total power of the equipped items and the damage per second with every bonus. */
  power: number;
  autoDps: number;
  /** What the equipped items and run buffs add to the clicker, and the lab effects they sum to. */
  clicker: LabLine[];
  effects: LabLine[];
  /** Run buffs picked, with how many times. */
  buffs: { id: string; name: string; emoji: string; description: string; count: number }[];
  /** An item waiting for the player to equip or recycle it, with the one it would replace and the Commits each recycle pays. */
  pending: { item: LabItemView; replaces: LabItemView | null; recycleNew: number; recycleOld: number | null } | null;
}

function clickerLines(content: GameContent, totals: LabTotals): LabLine[] {
  const lines: LabLine[] = [];
  for (const [stat, value] of totals.clicker) {
    if (value !== 0) lines.push({ label: content.lab.labels.stats[stat] ?? stat, text: statText(stat, value) });
  }
  return lines;
}

function effectLines(content: GameContent, totals: LabTotals): LabLine[] {
  const lines: LabLine[] = [];
  for (const key of LAB_EFFECT_KEYS) {
    const value = totals.lab[key];
    if (value !== 0) lines.push({ label: content.lab.labels.effects[key], text: labEffectText(key, value) });
  }
  return lines;
}

export function labBenchView(state: GameState, content: GameContent): LabBenchView {
  const { lab } = state;
  const totals = labTotals(state, content);
  const index = labIndex(content);
  const run = lab.turma.run;

  const slots = LAB_SLOTS.map((slot) => {
    const item = lab.turma.equipped[slot];
    return { slot, item: item ? labItemView(state, content, item, true) : null };
  });

  const buffs = Object.entries(run?.buffs ?? {}).flatMap(([id, count]) => {
    const def = index.buffs.get(id);
    return def && count > 0 ? [{ id, name: def.name, emoji: def.emoji, description: def.description, count }] : [];
  });

  let pending: LabBenchView['pending'] = null;
  if (run?.pending) {
    const view = labItemView(state, content, run.pending, false);
    const slot = view?.slot;
    const current = slot ? lab.turma.equipped[slot] : undefined;
    if (view) {
      // What recycling pays is the rarity's value with the Commits bonus of the tree and the items, as the engine pays it.
      const bonus = 1 + Math.max(0, totals.lab.commits);
      pending = {
        item: view,
        replaces: current ? labItemView(state, content, current, true) : null,
        recycleNew: Math.floor(recycleValue(content, run.pending) * bonus),
        recycleOld: current ? Math.floor(recycleValue(content, current) * bonus) : null,
      };
    }
  }

  return {
    unlocked: lab.unlocked,
    available: labRunAvailable(state, content),
    slots,
    power: totals.power,
    autoDps: autoDps(totals, false),
    clicker: clickerLines(content, totals),
    effects: effectLines(content, totals),
    buffs,
    pending,
  };
}

// ---------------------------------------------------------------------------
// Rewards
// ---------------------------------------------------------------------------

export interface LabOfferView {
  index: number;
  kind: LabOffer['kind'];
  title: string;
  emoji: string;
  description: string;
  /** Lines of what it gives (buffs and items). */
  lines: LabLine[];
  /** The item on offer, and the one it would take the place of. */
  item: LabItemView | null;
  replaces: LabItemView | null;
}

export interface LabRewardsView {
  /** The options are on screen: a phase was cleared and none picked yet. */
  open: boolean;
  phase: number;
  boss: boolean;
  options: LabOfferView[];
}

export function labRewardsView(state: GameState, content: GameContent): LabRewardsView {
  const run = state.lab.turma.run;
  if (!run || run.status !== 'reward') return { open: false, phase: run?.phase ?? 0, boss: false, options: [] };
  const index = labIndex(content);

  const options = run.offers.map((offer, i): LabOfferView => {
    switch (offer.kind) {
      case 'item': {
        const item = labItemView(state, content, offer.item, false);
        const current = item ? state.lab.turma.equipped[item.slot] : undefined;
        return {
          index: i,
          kind: 'item',
          title: item?.name ?? offer.item.base,
          emoji: item?.emoji ?? '?',
          description: item?.description ?? '',
          lines: item ? item.affixes.flatMap((affix) => affix.lines) : [],
          item,
          replaces: current ? labItemView(state, content, current, true) : null,
        };
      }
      case 'buff': {
        const def = index.buffs.get(offer.buff);
        const lines: LabLine[] = [];
        for (const modifier of def?.modifiers ?? []) {
          lines.push(...conversionLines(content, content.lab.affixes[modifier.target]?.[modifier.op], modifier.value));
        }
        for (const key of LAB_EFFECT_KEYS) {
          const value = def?.lab[key];
          if (value !== undefined) lines.push({ label: content.lab.labels.effects[key], text: labEffectText(key, value) });
        }
        return { index: i, kind: 'buff', title: def?.name ?? offer.buff, emoji: def?.emoji ?? '?', description: def?.description ?? '', lines, item: null, replaces: null };
      }
      case 'commits':
        return {
          index: i,
          kind: 'commits',
          title: `${offer.amount} Commits`,
          emoji: '🪙',
          description: 'Commits para a árvore do Laboratório. Valem para sempre.',
          lines: [],
          item: null,
          replaces: null,
        };
      case 'repair':
        return {
          index: i,
          kind: 'repair',
          title: 'Reparo do monitor',
          emoji: '🔧',
          description: `Restaura ${Math.round(offer.share * 100)}% da integridade do monitor.`,
          lines: [],
          item: null,
          replaces: null,
        };
    }
  });

  return { open: true, phase: run.phase, boss: isBossPhase(content, run.phase), options };
}

// ---------------------------------------------------------------------------
// The tree
// ---------------------------------------------------------------------------

export interface LabNodeView {
  id: string;
  branch: LabNodeDef['branch'];
  name: string;
  emoji: string;
  description: string;
  level: number;
  maxLevel: number;
  /** Commits of the next level, or null when maxed. */
  cost: number | null;
  affordable: boolean;
  /** Parent nodes are owned. */
  available: boolean;
  maxed: boolean;
  requires: string[];
  position: { col: number; row: number };
  /** What the node changes, as it stands now and after the next level ('+0%' -> '+10%'). Empty when maxed. */
  effects: { label: string; now: string; next: string }[];
}

export interface LabTreeView {
  unlocked: boolean;
  commits: number;
  spent: number;
  nodes: LabNodeView[];
}

/** The effects of a node written as the change one more level makes. */
function nodeEffects(content: GameContent, def: LabNodeDef, level: number): LabNodeView['effects'] {
  if (level >= def.maxLevel) return [];
  const lines: LabNodeView['effects'] = [];
  for (const key of LAB_EFFECT_KEYS) {
    const per = def.effects[key];
    if (per === undefined) continue;
    const text = (owned: number) => (key === 'startSetup' || key === 'secondWind' ? (owned > 0 ? 'sim' : 'não') : labEffectText(key, per * owned));
    lines.push({ label: content.lab.labels.effects[key], now: text(level), next: text(level + 1) });
  }
  return lines;
}

export function labTreeView(state: GameState, content: GameContent): LabTreeView {
  const nodes = content.lab.tree.map((def): LabNodeView => {
    const level = labNodeLevel(state, def.id);
    const maxed = level >= def.maxLevel;
    const cost = maxed ? null : labNodeCost(def, level);
    return {
      id: def.id,
      branch: def.branch,
      name: def.name,
      emoji: def.emoji,
      description: def.description,
      level,
      maxLevel: def.maxLevel,
      cost,
      affordable: cost !== null && state.lab.commits >= cost,
      available: labNodeAvailable(state, def),
      maxed,
      requires: def.requires,
      position: def.position,
      effects: nodeEffects(content, def, level),
    };
  });
  return { unlocked: state.lab.unlocked, commits: state.lab.commits, spent: labTreeSpent(state, content), nodes };
}
