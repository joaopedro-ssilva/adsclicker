import type { AchievementDef, Condition, GameContent } from '../content/types';
import type { Emit } from '../store/types';
import { getIndex } from './contentIndex';
import { Decimal, parseDecimal, ratio } from './decimal';
import { clickValueWith, coinsPerSecondWith, levelOf } from './economy';
import type { GameState } from './state';
import { achievementCount, computeStats } from './stats';
import type { Stats } from './stats';

/** Minimum time between full scans triggered by the tick. */
export const ACHIEVEMENT_SCAN_MS = 1000;

export interface Measure {
  /** 0..1 when the condition can be measured, else null (secrets and yes/no conditions report 0 or 1). */
  progress: number | null;
  met: boolean;
}

/** Lazily computed derived values, shared by every condition of one scan. */
export interface Probe {
  coinsPerSecond(): Decimal;
  clickValue(): Decimal;
}

export function createProbe(state: GameState, content: GameContent): Probe {
  let cps: Decimal | null = null;
  let click: Decimal | null = null;
  let stats: Stats | null = null;
  const getStats = () => (stats ??= computeStats(state, content));
  return {
    coinsPerSecond: () => (cps ??= coinsPerSecondWith(state, content, getStats())),
    clickValue: () => (click ??= clickValueWith(state, content, getStats())),
  };
}

const fraction = (value: number, target: number) => (target <= 0 ? 1 : Math.min(1, Math.max(0, value / target)));

function measureBoolean(met: boolean): Measure {
  return { progress: met ? 1 : 0, met };
}

function measureAtLeast(value: number, target: number): Measure {
  return { progress: fraction(value, target), met: value >= target };
}

function measureDecimal(value: Decimal, target: Decimal): Measure {
  return { progress: ratio(value, target), met: value.gte(target) };
}

export function measureCondition(state: GameState, content: GameContent, condition: Condition, probe: Probe): Measure {
  const index = getIndex(content);
  switch (condition.kind) {
    case 'counter':
      return measureAtLeast(state.counters[condition.counter], condition.gte);
    case 'lifetimeCoins':
      return measureDecimal(state.lifetimeCoins, parseDecimal(condition.gte));
    case 'coinsPerSecond':
      return measureDecimal(probe.coinsPerSecond(), parseDecimal(condition.gte));
    case 'clickValue':
      return measureDecimal(probe.clickValue(), parseDecimal(condition.gte));
    case 'disciplineLevel':
      return measureAtLeast(levelOf(state, condition.discipline), condition.level);
    case 'allDisciplinesLevel': {
      const list = index.disciplinesOf[condition.professor];
      if (list.length === 0) return { progress: 0, met: false };
      let reached = 0;
      let met = true;
      for (const def of list) {
        const level = levelOf(state, def.id);
        reached += Math.min(level, condition.level);
        if (level < condition.level) met = false;
      }
      return { progress: fraction(reached, condition.level * list.length), met };
    }
    case 'professorHired':
      return measureBoolean(state.hired[condition.professor]);
    case 'professorsHired': {
      const count = index.professorList.filter((p) => state.hired[p.id]).length;
      return measureAtLeast(count, condition.gte);
    }
    case 'allResearch': {
      const list = index.researchOf[condition.professor];
      if (list.length === 0) return { progress: 0, met: false };
      const bought = list.filter((def) => state.research[def.id]).length;
      return { progress: bought / list.length, met: bought === list.length };
    }
    case 'diplomasEarned':
      return measureAtLeast(state.diplomasEarned, condition.gte);
    case 'prestigeNodes': {
      let owned = 0;
      for (const id in state.prestige) if ((state.prestige[id] ?? 0) > 0 && index.prestigeNodes.has(id)) owned += 1;
      return measureAtLeast(owned, condition.gte);
    }
    case 'achievements':
      return measureAtLeast(achievementCount(state), condition.gte);
    case 'skinsOwned': {
      let owned = 0;
      for (const id in state.skins) {
        const skin = index.skins.get(id);
        if (state.skins[id] && skin && (!condition.professor || skin.professor === condition.professor)) owned += 1;
      }
      return measureAtLeast(owned, condition.gte);
    }
    case 'secret':
      return { progress: null, met: state.secrets[condition.trigger] === true };
  }
}

/** 0..1 progress of an achievement, or null when not measurable. 1 once unlocked. */
export function achievementProgress(state: GameState, content: GameContent, def: AchievementDef, probe: Probe): number | null {
  if (state.achievements[def.id] !== undefined) return def.condition.kind === 'secret' ? null : 1;
  return measureCondition(state, content, def.condition, probe).progress;
}

/** Grants the cosmetics of an achievement the player does not own yet, announcing each one. */
export function grantAchievementRewards(state: GameState, content: GameContent, def: AchievementDef, emit: Emit): void {
  const index = getIndex(content);
  const reward = def.reward;
  if (!reward) return;
  const skin = reward.skin ? index.skins.get(reward.skin) : undefined;
  if (skin && !state.skins[skin.id]) {
    state.skins[skin.id] = true;
    emit({ type: 'unlock', kind: 'skin', id: skin.id, rarity: skin.rarity });
  }
  if (reward.scenery && index.sceneries.has(reward.scenery) && !state.sceneries[reward.scenery]) {
    state.sceneries[reward.scenery] = true;
    emit({ type: 'unlock', kind: 'scenery', id: reward.scenery });
  }
  if (reward.theme && index.themes.has(reward.theme) && !state.themes[reward.theme]) {
    state.themes[reward.theme] = true;
    emit({ type: 'unlock', kind: 'theme', id: reward.theme });
  }
}

/**
 * Unlocks every achievement whose condition is met. Repeats while something new unlocks, since
 * conditions like `achievements gte N` and `skinsOwned` depend on earlier unlocks.
 * Returns the ids unlocked.
 */
export function checkAchievements(state: GameState, content: GameContent, now: number, emit: Emit): string[] {
  state.lastAchievementCheckAt = now;
  const unlocked: string[] = [];
  const pending = content.achievements.filter((def) => state.achievements[def.id] === undefined);
  const probe = createProbe(state, content);

  for (let pass = 0; pass < 4; pass += 1) {
    let progressed = false;
    for (const def of pending) {
      if (state.achievements[def.id] !== undefined) continue;
      if (!measureCondition(state, content, def.condition, probe).met) continue;
      state.achievements[def.id] = now;
      unlocked.push(def.id);
      progressed = true;
      emit({ type: 'achievement', id: def.id });
      grantAchievementRewards(state, content, def, emit);
    }
    if (!progressed) break;
  }
  return unlocked;
}

/** Same scan, skipped when the last one was less than a second ago. Used by the tick and by clicks. */
export function checkAchievementsThrottled(state: GameState, content: GameContent, now: number, emit: Emit): void {
  if (now - state.lastAchievementCheckAt >= ACHIEVEMENT_SCAN_MS) checkAchievements(state, content, now, emit);
}
