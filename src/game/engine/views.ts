/**
 * Pure view-model builders for the UI. They are called on every render (up to 10 Hz), so they
 * share one lazily filled cache per state reference (see stats.getStateCache) and never mutate.
 */
import type { GameContent, ProfessorDef, ProfessorId } from '../content/types';
import type {
  AbilityView,
  AchievementView,
  GraduationPreview,
  LevelledView,
  PrestigeNodeView,
  ProfessorView,
  ResearchView,
} from '../store/types';
import { achievementProgress, createProbe } from './achievements';
import { abilityCooldownLeft } from './buffs';
import { getIndex } from './contentIndex';
import type { LevelledDef } from './contentIndex';
import { Decimal, ZERO, parseDecimal, ratio } from './decimal';
import {
  clickUpgradeOutput,
  clickValueWith,
  coinsPerSecondWith,
  disciplineProduction,
  hiredCount,
  levelOf,
} from './economy';
import { nextMilestone, previousMilestone } from './formulas';
import { diplomasFor, prestigeNodeAvailable, prestigeNodeCost, runCoinsFor } from './prestige';
import { effectiveBuyAmount, quoteLevels } from './purchases';
import { hireLock, isAbilityUnlocked, levelledLock, researchLock } from './requirements';
import type { GameState } from './state';
import { getStateCache, hasFeature } from './stats';
import type { Stats } from './stats';

export { cachedStats as statsOf, hasFeature } from './stats';
export { effectiveBuyAmount } from './purchases';

/** Coins/second right now (production of every discipline, buffs included). Cached per state reference. */
export function coinsPerSecond(state: GameState, content: GameContent): Decimal {
  const cache = getStateCache(state, content);
  cache.coinsPerSecond ??= coinsPerSecondWith(state, content, cache.stats);
  return cache.coinsPerSecond;
}

/** Coins per click before combo and crit (includes clickFromIdle). Cached per state reference. */
export function clickValue(state: GameState, content: GameContent): Decimal {
  const cache = getStateCache(state, content);
  cache.clickValue ??= clickValueWith(state, content, cache.stats);
  return cache.clickValue;
}

export interface ComboInfo {
  /** Whole combo steps. */
  steps: number;
  max: number;
  /** Current click multiplier from the combo. */
  multiplier: number;
  /** Combo layer unlocked (the `combo` feature). */
  unlocked: boolean;
}

export function comboInfo(state: GameState, content: GameContent): ComboInfo {
  const { stats } = getStateCache(state, content);
  const steps = Math.floor(state.combo.steps);
  return {
    steps,
    max: stats.comboMax,
    multiplier: 1 + state.combo.steps * stats.comboStep,
    unlocked: hasFeature(state, content, 'combo'),
  };
}

// ---------------------------------------------------------------------------
// Disciplines and click upgrades
// ---------------------------------------------------------------------------

function outputOf(state: GameState, content: GameContent, stats: Stats, entry: LevelledDef, level: number, hired: number): Decimal {
  return entry.kind === 'discipline'
    ? disciplineProduction(state, content, stats, entry.def, level, hired)
    : clickUpgradeOutput(content, stats, entry.def, level);
}

function buildLevelled(state: GameState, content: GameContent, entry: LevelledDef): LevelledView {
  const { stats } = getStateCache(state, content);
  const { balance } = content;
  const def = entry.def;
  const hired = hiredCount(state);
  const level = levelOf(state, def.id);
  const lockReason = levelledLock(state, content, entry);
  const { count, cost } = quoteLevels(state, content, stats, def.id, effectiveBuyAmount(state, content));
  const output = outputOf(state, content, stats, entry, level, hired);
  const gainAfter = outputOf(state, content, stats, entry, level + count, hired).sub(output);

  const previous = previousMilestone(level, balance);
  const next = nextMilestone(level, balance);
  const cps = coinsPerSecond(state, content);

  return {
    id: def.id,
    kind: entry.kind,
    professor: def.professor,
    name: def.name,
    emoji: def.emoji,
    description: def.description,
    level,
    unlocked: lockReason === null,
    lockReason,
    buyCount: count,
    cost,
    affordable: lockReason === null && state.coins.gte(cost),
    output,
    outputGain: gainAfter,
    nextMilestone: next,
    milestoneProgress: next === null ? 1 : Math.min(1, Math.max(0, (level - previous) / (next - previous))),
    share: entry.kind === 'discipline' && cps.gt(0) ? ratio(output, cps) : 0,
  };
}

export function disciplineViews(state: GameState, content: GameContent): LevelledView[] {
  return content.disciplines.map((def) => buildLevelled(state, content, { kind: 'discipline', def }));
}

export function clickUpgradeViews(state: GameState, content: GameContent): LevelledView[] {
  return content.clickUpgrades.map((def) => buildLevelled(state, content, { kind: 'clickUpgrade', def }));
}

/** One discipline or click upgrade by id, or null when the id is unknown. */
export function levelledView(state: GameState, content: GameContent, id: string): LevelledView | null {
  const entry = getIndex(content).levelled.get(id);
  return entry ? buildLevelled(state, content, entry) : null;
}

// ---------------------------------------------------------------------------
// Research, professors, abilities
// ---------------------------------------------------------------------------

export function researchViews(state: GameState, content: GameContent): ResearchView[] {
  return content.research.map((def) => {
    const cost = parseDecimal(def.cost);
    const bought = state.research[def.id] === true;
    const visible = researchLock(state, content, def) === null;
    return {
      id: def.id,
      professor: def.professor,
      name: def.name,
      emoji: def.emoji,
      description: def.description,
      cost,
      bought,
      visible,
      affordable: !bought && visible && state.coins.gte(cost),
    };
  });
}

/** Professors in hire order. */
export function professorViews(state: GameState, content: GameContent): ProfessorView[] {
  const index = getIndex(content);
  const { stats } = getStateCache(state, content);
  const hired = hiredCount(state);
  const production = {} as Record<ProfessorId, Decimal>;
  for (const def of content.disciplines) {
    const level = levelOf(state, def.id);
    if (level > 0) {
      production[def.professor] = (production[def.professor] ?? ZERO).add(
        disciplineProduction(state, content, stats, def, level, hired),
      );
    }
  }

  return index.professorList.map((def: ProfessorDef) => {
    const isHired = state.hired[def.id];
    const lockReason = isHired ? null : hireLock(state, content, def);
    const hireCost = parseDecimal(def.hireCost);
    return {
      id: def.id,
      name: def.name,
      subject: def.subject,
      tagline: def.tagline,
      color: def.color,
      order: def.order,
      hired: isHired,
      active: state.activeProfessor === def.id,
      hireCost,
      canBeHired: !isHired && lockReason === null,
      affordable: !isHired && lockReason === null && state.coins.gte(hireCost),
      lockReason,
      production: production[def.id] ?? ZERO,
      equippedSkin: state.equippedSkin[def.id],
    };
  });
}

/** Every ability, hired or not. `now` defaults to the last tick. */
export function abilityViews(state: GameState, content: GameContent, now: number = state.lastTickAt): AbilityView[] {
  return content.abilities.map((def) => {
    const buff = state.buffs.find((b) => b.id === def.buff.id);
    return {
      id: def.id,
      professor: def.professor,
      name: def.name,
      emoji: def.emoji,
      description: def.description,
      unlocked: isAbilityUnlocked(state, content, def),
      cooldownLeftMs: abilityCooldownLeft(state, def.id, now),
      cooldownMs: def.cooldownMs * getStateCache(state, content).stats.abilityCooldown,
      activeLeftMs: buff ? Math.max(0, buff.endsAt - now) : 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Prestige
// ---------------------------------------------------------------------------

export function prestigeNodeViews(state: GameState, content: GameContent): PrestigeNodeView[] {
  return content.prestigeNodes.map((def) => {
    const level = state.prestige[def.id] ?? 0;
    const maxed = level >= def.maxLevel;
    const available = prestigeNodeAvailable(state, def);
    const cost = prestigeNodeCost(def, maxed ? Math.max(0, level - 1) : level);
    return {
      id: def.id,
      level,
      maxLevel: def.maxLevel,
      cost,
      affordable: !maxed && available && state.diplomas >= cost,
      available,
      maxed,
    };
  });
}

export function graduationPreview(state: GameState, content: GameContent): GraduationPreview {
  const { stats } = getStateCache(state, content);
  const unlocked = hasFeature(state, content, 'graduation');
  const diplomas = diplomasFor(state.runCoins, content, stats);
  const current = runCoinsFor(diplomas, content, stats);
  const nextAt = runCoinsFor(diplomas + 1, content, stats);
  const span = nextAt.sub(current);
  return {
    unlocked,
    diplomas,
    nextAt,
    progress: span.gt(0) ? ratio(state.runCoins.sub(current), span) : 0,
    canGraduate: unlocked && diplomas >= 1,
  };
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

export function achievementViews(state: GameState, content: GameContent): AchievementView[] {
  const probe = createProbe(state, content);
  return content.achievements.map((def) => {
    const unlockedAt = state.achievements[def.id];
    return {
      id: def.id,
      unlocked: unlockedAt !== undefined,
      unlockedAt: unlockedAt ?? null,
      progress: achievementProgress(state, content, def, probe),
    };
  });
}
