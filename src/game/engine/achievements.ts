import { PROFESSOR_IDS } from '../content/types';
import type { AchievementDef, Condition, GameContent } from '../content/types';
import type { Emit } from '../store/types';
import { getIndex } from './contentIndex';
import { Decimal, parseDecimal, ratio } from './decimal';
import { clickValueWith, coinsPerSecondWith, levelOf } from './economy';
import { horasBandsFilled } from './maestria/horas';
import { releaseVersions } from './maestria/releases';
import { maestriaLevel } from './maestria/slots';
import { masteryLevels, masteryRank } from './mastery';
import type { GameState, LastRun } from './state';
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

/** The metric a `lastRun` condition limits. */
export function lastRunValue(last: LastRun, metric: 'seconds' | 'clicks' | 'investedProfessors'): number {
  return metric === 'seconds' ? last.seconds : metric === 'clicks' ? last.clicks : last.investedProfessors;
}

/** The four parts of a clean run: no sprint failed, no invasion missed, a sprint done, an invasion defended. */
export function cleanRunSteps(last: LastRun): boolean[] {
  return [last.sprintsFailed === 0, last.eventsMissed === 0, last.sprintsCompleted >= 1, last.eventsDefended >= 1];
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
    case 'session':
      return measureAtLeast(state.session.seconds, condition.gte);
    case 'runCounter':
      return measureAtLeast(state.run[condition.counter], condition.gte);
    case 'professorLevels':
      return measureAtLeast(masteryLevels(state, content, condition.professor), condition.gte);
    case 'mastery': {
      const professors = condition.professor ? [condition.professor] : index.professorList.map((p) => p.id);
      let reached = 0;
      let met = true;
      for (const id of professors) {
        const rank = masteryRank(state, content, id);
        reached += Math.min(rank, condition.rank);
        if (rank < condition.rank) met = false;
      }
      return { progress: fraction(reached, condition.rank * professors.length), met };
    }
    case 'alignedLevels': {
      let best = 0;
      let met = false;
      for (const professor of index.professorList) {
        const list = index.disciplinesOf[professor.id];
        if (list.length === 0) continue;
        const levels = list.map((def) => levelOf(state, def.id));
        const lowest = Math.min(...levels);
        best = Math.max(best, lowest);
        if (lowest >= condition.level && levels.every((level) => level === lowest)) met = true;
      }
      return { progress: met ? 1 : fraction(best, condition.level), met };
    }
    case 'abilitiesTried': {
      const total = content.abilities.length;
      const tried = content.abilities.filter((def) => state.abilitiesTried[def.id]).length;
      return { progress: total === 0 ? 0 : tried / total, met: total > 0 && tried === total };
    }
    case 'abilitiesActive': {
      const total = content.abilities.length;
      // Only buffs the player started by hand: the Festa de lançamento fires every ability by itself.
      const running = content.abilities.filter((def) => state.buffs.some((buff) => buff.id === def.buff.id && buff.source === 'ability')).length;
      return { progress: total === 0 ? 0 : running / total, met: total > 0 && running === total };
    }
    case 'everyResearch': {
      const total = content.research.length;
      const bought = content.research.filter((def) => state.research[def.id]).length;
      return { progress: total === 0 ? 0 : bought / total, met: total > 0 && bought === total };
    }
    case 'rarityOwned': {
      const list = content.skins.filter((skin) => skin.rarity === condition.rarity);
      const owned = list.filter((skin) => state.skins[skin.id]).length;
      return { progress: list.length === 0 ? 0 : owned / list.length, met: list.length > 0 && owned === list.length };
    }
    case 'honoured':
      return measureAtLeast(Object.keys(state.honouredBefore).filter((id) => id in content.professors).length, condition.gte);
    case 'graduationsToday':
      return measureAtLeast(state.calendar.gradsToday, condition.gte);
    case 'lastRun': {
      const last = state.lastRun;
      if (!last) return { progress: 0, met: false };
      const value = lastRunValue(last, condition.metric);
      // "At most" goal: the closer the run was to the limit, the fuller the bar.
      return { progress: value <= condition.lte ? 1 : fraction(condition.lte, value), met: value <= condition.lte };
    }
    case 'lastRunClickShare': {
      const share = state.lastRun?.clickShare ?? 0;
      return { progress: fraction(share, condition.gte), met: state.lastRun !== null && share >= condition.gte };
    }
    case 'maestrias': {
      const needed = condition.level ?? 1;
      const count = PROFESSOR_IDS.filter((id) => maestriaLevel(state, id) >= needed).length;
      return measureAtLeast(count, condition.unlocked);
    }
    case 'lastRunClean': {
      const last = state.lastRun;
      if (last === null) return { progress: 0, met: false };
      const steps = cleanRunSteps(last);
      const done = steps.filter(Boolean).length;
      return { progress: done / steps.length, met: done === steps.length };
    }
    case 'everyOwned': {
      const { owned, total } = ownedCount(state, content, condition.of, condition.except);
      return { progress: total === 0 ? 0 : owned / total, met: total > 0 && owned === total };
    }
    case 'everyAchievement': {
      const { done, total } = achievementsDone(state, content, condition.except);
      return { progress: total === 0 ? 0 : done / total, met: total > 0 && done === total };
    }
    case 'prestigeComplete': {
      const { levels, total } = prestigeProgress(state, content);
      return { progress: total === 0 ? 0 : levels / total, met: total > 0 && levels === total };
    }
    case 'releaseVersions':
      return measureAtLeast(releaseVersions(state, content), condition.gte);
    case 'horasBands':
      return measureAtLeast(horasBandsFilled(state, content), condition.gte);
    case 'bolsaPortfolio': {
      const { held, total } = bolsaHeld(state, content);
      return { progress: total === 0 ? 0 : held / total, met: total > 0 && held === total };
    }
    case 'monitors':
      return measureAtLeast(monitorsReached(state, content, condition.maxed === true), condition.gte);
  }
}

/** Sceneries or themes owned out of all those of the game, leaving out the ones an achievement hands out itself. */
export function ownedCount(state: GameState, content: GameContent, of: 'sceneries' | 'themes', except: string[] = []): { owned: number; total: number } {
  const list = (of === 'sceneries' ? content.sceneries : content.themes).filter((item) => !except.includes(item.id));
  const have = of === 'sceneries' ? state.sceneries : state.themes;
  return { owned: list.filter((item) => have[item.id]).length, total: list.length };
}

/** Achievements unlocked out of all those of the game, leaving out the ones named. */
export function achievementsDone(state: GameState, content: GameContent, except: string[] = []): { done: number; total: number } {
  const list = content.achievements.filter((def) => !except.includes(def.id));
  return { done: list.filter((def) => state.achievements[def.id] !== undefined).length, total: list.length };
}

/** Levels owned in the Formatura tree and the levels of the whole tree. */
export function prestigeProgress(state: GameState, content: GameContent): { levels: number; total: number } {
  let levels = 0;
  let total = 0;
  for (const node of content.prestigeNodes) {
    total += node.maxLevel;
    levels += Math.min(node.maxLevel, state.prestige[node.id] ?? 0);
  }
  return { levels, total };
}

/** Assets of the Bolsa (the Fundo counted as one more) with something held, and how many there are. */
export function bolsaHeld(state: GameState, content: GameContent): { held: number; total: number } {
  const bolsa = state.maestria.bolsa;
  const assets = content.maestrias.bolsa.assets;
  const held = assets.filter((def) => bolsa.assets[def.id]?.held.units.gt(0)).length + (bolsa.fund.units.gt(0) ? 1 : 0);
  return { held, total: assets.length + 1 };
}

/** Monitores hired, or at their top level when `maxed`. */
export function monitorsReached(state: GameState, content: GameContent, maxed: boolean): number {
  return content.monitors.filter((def) => {
    const level = state.monitors.units[def.id]?.level ?? 0;
    return maxed ? level >= def.levels.length : level >= 1;
  }).length;
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
