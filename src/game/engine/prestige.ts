import { PROFESSOR_IDS } from '../content/types';
import type { Effect, GameContent, PrestigeNodeDef, ProfessorId } from '../content/types';
import type { Emit } from '../store/types';
import { getIndex } from './contentIndex';
import { Decimal, ZERO, parseDecimal, ratio } from './decimal';
import { createRunStats } from './init';
import { horasBandsFilled, liquidateBolsa, resetMaestriasForGraduation } from './maestria';
import { masteryRank } from './mastery';
import { recordGraduationDay } from './session';
import type { GameState, RecordKey, RunSummary } from './state';
import { computeStats, hasFeature } from './stats';
import type { Stats } from './stats';

/** diplomas = floor((runCoins / base) ^ exponent x diplomaGain) */
export function diplomasFor(runCoins: Decimal, content: GameContent, stats: Stats): number {
  const { base, exponent } = content.balance.graduation;
  const reference = parseDecimal(base);
  if (reference.lte(0) || runCoins.lte(0)) return 0;
  const value = runCoins.div(reference).pow(exponent).mul(stats.diplomaGain).floor().toNumber();
  if (Number.isNaN(value)) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, value));
}

/** The diploma gain Angelo's Domínio (at `rank`) and his honour (when `honoured`) give, as a multiplier. */
function angeloGain(content: GameContent, rank: number, honoured: boolean): number {
  const def = content.mastery.angelo;
  let add = 0;
  let mult = 1;
  const apply = (effects: readonly Effect[], levels: number) => {
    for (const effect of effects) {
      if (effect.stat !== 'diplomaGain') continue;
      if (effect.op === 'add') add += effect.value * levels;
      else mult *= effect.value ** levels;
    }
  };
  apply(def.perRank, rank);
  if (honoured) {
    apply(def.honour.flat ?? [], 1);
    apply(def.honour.perRank ?? [], rank);
  }
  return (1 + add) * mult;
}

/**
 * How much Angelo stretches this run's diploma cap: the same proportion his Domínio and his honour add to the
 * diplomas (the tree and the research are not his, and still stop at the cap). 1 while he is not hired.
 */
export function angeloCapFactor(state: GameState, content: GameContent): number {
  if (!state.hired.angelo) return 1;
  return angeloGain(content, masteryRank(state, content, 'angelo'), state.honoured === 'angelo');
}

/** The most Angelo can ever stretch the cap (Domínio maxed, plus the honour when he has been honoured): the server's ceiling. */
export function maxAngeloCapFactor(content: GameContent, honoured: boolean): number {
  return angeloGain(content, content.balance.mastery.cap, honoured);
}

/**
 * The diploma cap of a graduation made after `graduations` have been done, before Angelo's stretch:
 * base x growth ^ min(graduations, afterGraduation) x lateGrowth ^ (graduations past afterGraduation).
 * Null when the content sets no cap. Used by the engine and by the server's plausibility check.
 */
export function capBase(content: GameContent, graduations: number): number | null {
  const cap = content.balance.graduation.cap;
  if (!cap) return null;
  const flat = cap.afterGraduation ?? Number.POSITIVE_INFINITY;
  const late = cap.lateGrowth ?? cap.growth;
  return cap.base * cap.growth ** Math.min(graduations, flat) * late ** Math.max(0, graduations - flat);
}

/** Most diplomas the next graduation can pay: capBase for the graduations done, stretched by Angelo. Null when the content sets no cap. */
export function diplomaCap(state: GameState, content: GameContent): number | null {
  const base = capBase(content, state.counters.graduations);
  if (base === null) return null;
  const value = base * angeloCapFactor(state, content);
  return Number.isFinite(value) ? Math.floor(value + 1e-9) : Number.MAX_SAFE_INTEGER;
}

/** Diplomas the current run pays if the player graduates now: diplomasFor, held at the cap. */
export function diplomasForRun(state: GameState, content: GameContent, stats: Stats): number {
  const worth = diplomasFor(state.runCoins, content, stats);
  const cap = diplomaCap(state, content);
  return cap === null ? worth : Math.min(worth, cap);
}

/** Run coins needed to graduate with `diplomas` in total (the inverse of diplomasFor). */
export function runCoinsFor(diplomas: number, content: GameContent, stats: Stats): Decimal {
  const { base, exponent } = content.balance.graduation;
  if (diplomas <= 0) return ZERO;
  const gain = Math.max(stats.diplomaGain, 1e-9);
  return parseDecimal(base).mul(Decimal.pow(diplomas / gain, 1 / exponent));
}

export function canGraduate(state: GameState, content: GameContent, stats: Stats): boolean {
  return hasFeature(state, content, 'graduation') && diplomasForRun(state, content, stats) >= 1;
}

/** Professors that survive a graduation because of prestige nodes the player owns. */
export function keptProfessors(state: GameState, content: GameContent): Set<ProfessorId> {
  const kept = new Set<ProfessorId>();
  const index = getIndex(content);
  for (const id in state.prestige) {
    const node = index.prestigeNodes.get(id);
    if (node && (state.prestige[id] ?? 0) > 0) node.keepsProfessors?.forEach((p) => kept.add(p));
  }
  return kept;
}

/** Files the run against the personal bests and moves them. A mark that was not set yet is started, not beaten. */
function updateRecords(state: GameState): Pick<RunSummary, 'recordsBeaten' | 'recordsStarted'> {
  const { run, records } = state;
  const beaten: RecordKey[] = [];
  const started: RecordKey[] = [];
  const file = (key: RecordKey, better: boolean, hadMark: boolean) => {
    if (!better) return;
    (hadMark ? beaten : started).push(key);
  };
  file('fastestSeconds', run.seconds > 0 && (records.fastestSeconds <= 0 || run.seconds < records.fastestSeconds), records.fastestSeconds > 0);
  file('mostClicks', run.clicks > records.mostClicks, records.mostClicks > 0);
  file('biggestCombo', run.maxCombo > records.biggestCombo, records.biggestCombo > 0);
  file('mostCoins', state.runCoins.gt(records.mostCoins), records.mostCoins.gt(0));
  if (run.seconds > 0 && (records.fastestSeconds <= 0 || run.seconds < records.fastestSeconds)) records.fastestSeconds = run.seconds;
  records.mostClicks = Math.max(records.mostClicks, run.clicks);
  records.biggestCombo = Math.max(records.biggestCombo, run.maxCombo);
  records.mostCoins = Decimal.max(records.mostCoins, state.runCoins);
  return { recordsBeaten: beaten, recordsStarted: started };
}

/** Where the coins of the run came from. The classes are what is left, so the parts add up to the total paid. */
function coinSources(state: GameState): RunSummary['coins'] {
  const { run } = state;
  const clicks = Decimal.max(ZERO, run.clickCoins.sub(run.autoClickCoins));
  const classes = Decimal.max(
    ZERO,
    state.runCoins.sub(clicks).sub(run.autoClickCoins).sub(run.eventCoins).sub(run.sprintCoins).sub(run.offlineCoins).sub(run.extraCoins),
  );
  return {
    total: state.runCoins.toString(),
    classes: classes.toString(),
    clicks: clicks.toString(),
    autoClicks: run.autoClickCoins.toString(),
    events: run.eventCoins.toString(),
    sprints: run.sprintCoins.toString(),
    offline: run.offlineCoins.toString(),
    other: run.extraCoins.toString(),
  };
}

/**
 * Graduation: pays diplomas and resets the run. Resets coins, runCoins, levels, research, hires
 * (except the first professor and those kept by prestige nodes), buffs, invasion and streak, sprint,
 * combo and cooldowns. Keeps diplomas, the tree, achievements, cosmetics, counters and settings.
 *
 * `honour` is the hired professor the player picked to honour for the next run (none by default); it
 * replaces the previous pick. `now` only dates the graduation for the calendar achievements.
 */
export function graduate(
  state: GameState,
  content: GameContent,
  emit: Emit,
  now: number = state.lastTickAt,
  honour: ProfessorId | null = null,
): boolean {
  const stats = computeStats(state, content);
  if (!canGraduate(state, content, stats)) return false;
  // The Bolsa is cashed in first: its profit is part of the run, and nothing it holds carries over.
  liquidateBolsa(state, content);
  const diplomas = diplomasForRun(state, content, stats);
  const cap = diplomaCap(state, content);
  const worth = diplomasFor(state.runCoins, content, stats);
  const capped = cap !== null && worth > cap;
  if (cap !== null && worth >= cap) state.counters.cappedGraduations += 1;
  // Horas complementares: one diploma per band filled, outside the cap.
  const bonus = horasBandsFilled(state, content);
  const index = getIndex(content);
  const kept = keptProfessors(state, content);

  state.lastRun = {
    seconds: state.run.seconds,
    clicks: state.run.clicks,
    investedProfessors: PROFESSOR_IDS.filter((id) => index.disciplinesOf[id].some((def) => (state.levels[def.id] ?? 0) > 0)).length,
    clickShare: state.runCoins.gt(0) ? Math.min(1, ratio(state.run.clickCoins, state.runCoins)) : 0,
    sprintsCompleted: state.run.sprintsCompleted,
    sprintsFailed: state.run.sprintsFailed,
    eventsDefended: state.run.eventsDefended,
    eventsMissed: state.run.eventsMissed,
    summary: {
      diplomas: diplomas + bonus,
      bonus,
      capped,
      honoured: state.honoured,
      maxCombo: state.run.maxCombo,
      coins: coinSources(state),
      ...updateRecords(state),
    },
  };
  state.run = createRunStats();
  state.honoured = honour !== null && state.hired[honour] ? honour : null;
  if (state.honoured) state.honouredBefore[state.honoured] = true;
  recordGraduationDay(state, now);

  state.diplomas += diplomas + bonus;
  state.diplomasEarned += diplomas + bonus;
  state.counters.graduations += 1;

  state.coins = ZERO;
  state.runCoins = ZERO;
  state.levels = {};
  state.research = {};
  for (const id of PROFESSOR_IDS) state.hired[id] = id === index.firstProfessor || kept.has(id);
  if (!state.hired[state.activeProfessor]) state.activeProfessor = index.firstProfessor;

  state.buffs = [];
  state.abilityReadyAt = {};
  state.invasion = null;
  state.nextInvasionAt = 0;
  state.eventStreak = 0;
  state.sprint = { offers: [], active: null, nextOffersAt: 0 };
  state.combo = { steps: 0, lastClickAt: 0 };
  state.autoClickCarry = 0;
  resetMaestriasForGraduation(state);
  if (!hasFeature(state, content, 'bulkBuy')) state.buyAmount = 1;

  emit(bonus > 0 ? { type: 'graduate', diplomas: diplomas + bonus, bonus } : { type: 'graduate', diplomas });
  return true;
}

/** Diploma cost of the next level of a node: cost x costGrowth ^ level, rounded up. */
export function prestigeNodeCost(def: PrestigeNodeDef, level: number): number {
  return Math.ceil(def.cost * def.costGrowth ** level - 1e-9);
}

export function prestigeNodeAvailable(state: GameState, def: PrestigeNodeDef): boolean {
  return def.requires.every((id) => (state.prestige[id] ?? 0) > 0);
}

export function buyPrestigeNode(state: GameState, content: GameContent, id: string, emit: Emit): boolean {
  const def = getIndex(content).prestigeNodes.get(id);
  if (!def) return false;
  const level = state.prestige[id] ?? 0;
  if (level >= def.maxLevel || !prestigeNodeAvailable(state, def)) return false;
  const cost = prestigeNodeCost(def, level);
  if (state.diplomas < cost) return false;

  state.diplomas -= cost;
  state.prestige[id] = level + 1;
  emit({ type: 'purchase', kind: 'prestigeNode', id, levels: 1 });
  return true;
}
