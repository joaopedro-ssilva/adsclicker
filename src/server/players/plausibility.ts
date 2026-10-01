/**
 * Plausibility test for the leaderboards (docs/BACKEND.md). The game runs in the browser, so a
 * player can always edit their own save; what the server refuses is to rank one that the game
 * could not have produced. The save is compared with what its own state is able to earn in the
 * time that really passed (the server's clock), not with a fixed number.
 *
 * Every constant below is a slack that has to cover a gameplay mechanic the snapshot of the
 * state cannot show. They were checked against the simulator (plausibility.test.ts plays the
 * real content with the simulator and syncs every 45 s) and are deliberately generous: a false
 * positive costs an honest player the ranking, a missed cheat only costs a little fairness.
 */
import { content as gameContent } from '@/game/content';
import type { GameContent } from '@/game/content/types';
import { Decimal, ZERO, clickValue, coinsPerSecond, parseDecimal, statsOf } from '@/game/engine';
import type { GameState } from '@/game/engine/state';

/**
 * Seconds added to every time window. Covers network latency, the browser throttling timers,
 * a client clock a few seconds off, and the final sync sent when the page closes.
 */
export const TIME_GRACE_SECONDS = 30;

/**
 * The one-off allowances (grace, reward lumps, the Hiperespaço clicks) are earned by waiting: a
 * window shorter than this gets that fraction of them. Without it a client could sync as fast
 * as the rate limit lets it and collect a full allowance every time.
 */
export const ALLOWANCE_FULL_AFTER_SECONDS = 45;

/** Offline returns one window can hold: one per minute of play, plus one (the game needs 60 s away to pay). */
export const OFFLINE_RETURN_EVERY_SECONDS = 60;

/**
 * Multiplier on idle production over the window. The state only shows the buffs active at the
 * moment of the snapshot, but buffs that started and ended inside the window also paid: Auto
 * Scaling (x5, 30 s), invasion and sprint buffs (x3, 15-30 s). They can overlap, and a long
 * window (the tab was hidden, so no sync) averages them out, so 5 covers the strongest realistic
 * stack for a normal window with room to spare.
 */
export const PRODUCTION_SLACK = 5;

/**
 * Extra seconds of production allowed per sync for lump rewards. Invasions and sprints pay
 * "N seconds of production" at once: up to 150 s x event reward bonuses (about x2.5 with
 * research and tree nodes) for an invasion and 125 s x about x1.7 for a sprint, and a few can
 * land inside one window.
 */
export const REWARD_LUMP_SECONDS = 450;

/**
 * Hand clicks per second a human can sustain (autoclick mice and two-finger tapping reach 15
 * to 20). Used for both the click counter and the coins clicks can produce.
 */
export const MAX_CLICKS_PER_SECOND = 20;

/**
 * Automatic clicks the Hiperespaço buff (+20/s for 20 s) can add inside one window even when
 * it has already ended at the snapshot, so the stat does not show it. A lump, not a rate.
 */
export const AUTO_CLICK_BUFF_CLICKS = 400;

/**
 * Multiplier on top of the combo and crit the state itself shows (combo at its maximum and the
 * average crit). It covers the click buffs that can be gone by the snapshot: Aula Show (x10,
 * 15 s) and the invasion and sprint x10, which fill only part of a window, and crit luck.
 */
export const CLICK_BUFF_SLACK = 4;

/** Clicks allowed beyond the rate, for the very first sync and for rounding. */
export const CLICK_COUNT_GRACE = 50;

/**
 * Lifetime coins may fall by this fraction between syncs without it counting as "went
 * backwards": the engine stores decimals as text and rounds the last digits.
 */
export const BACKWARDS_TOLERANCE = 1e-6;

/** A save whose coins pass this power of ten is refused outright (it could not be stored as `numeric` anyway). */
export const MAX_COIN_EXPONENT = 5_000;

/** `ratio` is gain / ceiling of the coins check (1 = right at the limit), for calibration. */
export type Verdict = { ok: true; ratio: number } | { ok: false; reason: string };

export interface JudgeInput {
  /** The stored save before this sync; null for the first sync, or when the player forced an overwrite. */
  previous: GameState | null;
  next: GameState;
  /** Server clock milliseconds since the previous accepted sync. Ignored without `previous`. */
  elapsedMs: number;
  content?: GameContent;
}

const fail = (reason: string): Verdict => ({ ok: false, reason });

/** Rates of one state: coins/s, value of a click, automatic clicks/s, offline seconds one return can pay. */
function rates(state: GameState, content: GameContent) {
  const stats = statsOf(state, content);
  return {
    cps: coinsPerSecond(state, content),
    click: clickValue(state, content),
    autoClicks: stats.autoClicks,
    offlineSeconds: stats.offlineHours * 3600 * stats.offlineRate,
    diplomaGain: stats.diplomaGain,
    // What a click is worth at best, as a multiple of the base click: full combo and the average crit.
    clickFactor: (1 + stats.comboMax * stats.comboStep) * (1 + stats.critChance * (stats.critMult - 1)),
  };
}


export function judgeSave({ previous, next, elapsedMs, content = gameContent }: JudgeInput): Verdict {
  let ratio = 0;
  const nextRates = rates(next, content);
  const prevRates = previous ? rates(previous, content) : null;

  let gain = next.lifetimeCoins;
  let seconds = next.counters.playSeconds;
  let offlineReturns = next.counters.offlineCollections;
  let clicksDone = next.counters.clicks;
  let graduationsDone = next.counters.graduations;
  let diplomasDone = next.diplomasEarned;
  let runPool = next.lifetimeCoins;

  if (previous) {
    const floor = previous.lifetimeCoins.mul(1 - BACKWARDS_TOLERANCE);
    if (next.lifetimeCoins.lt(floor)) return fail('lifetime coins went backwards');
    if (next.counters.clicks < previous.counters.clicks) return fail('clicks went backwards');
    if (next.counters.graduations < previous.counters.graduations) return fail('graduations went backwards');
    if (next.diplomasEarned < previous.diplomasEarned) return fail('diplomas went backwards');

    gain = Decimal.max(ZERO, next.lifetimeCoins.sub(previous.lifetimeCoins));
    seconds = Math.max(0, elapsedMs) / 1000;
    offlineReturns = Math.max(0, next.counters.offlineCollections - previous.counters.offlineCollections);
    clicksDone = next.counters.clicks - previous.counters.clicks;
    graduationsDone = next.counters.graduations - previous.counters.graduations;
    diplomasDone = next.diplomasEarned - previous.diplomasEarned;
    // Graduation spends the run's coins: what could have been graduated on is the old run plus the gain.
    runPool = previous.runCoins.add(gain);
  }

  // The first sync (no baseline) has no clock to wait on, so it gets the allowances in full.
  const allowance = previous ? Math.min(1, seconds / ALLOWANCE_FULL_AFTER_SECONDS) : 1;
  const window = seconds + TIME_GRACE_SECONDS * allowance;
  const best = (pick: (r: ReturnType<typeof rates>) => Decimal): Decimal =>
    prevRates ? Decimal.max(pick(nextRates), pick(prevRates)) : pick(nextRates);
  const bestNumber = (pick: (r: ReturnType<typeof rates>) => number): number =>
    prevRates ? Math.max(pick(nextRates), pick(prevRates)) : pick(nextRates);

  const autoClicks = bestNumber((r) => r.autoClicks);
  const clicksAllowed = (MAX_CLICKS_PER_SECOND + autoClicks) * window + AUTO_CLICK_BUFF_CLICKS * allowance;
  if (clicksDone > MAX_CLICKS_PER_SECOND * window + CLICK_COUNT_GRACE * allowance) return fail('more clicks than possible');

  const returns = Math.min(offlineReturns, 1 + window / OFFLINE_RETURN_EVERY_SECONDS);
  const offlineSeconds = returns * bestNumber((r) => r.offlineSeconds);
  const productionSeconds = window * PRODUCTION_SLACK + offlineSeconds + REWARD_LUMP_SECONDS * allowance;
  const clickFactor = bestNumber((r) => r.clickFactor) * CLICK_BUFF_SLACK;
  const ceiling = best((r) => r.cps)
    .mul(productionSeconds)
    .add(best((r) => r.click).mul(clicksAllowed * clickFactor));
  ratio = gain.div(Decimal.max(ceiling, 1e-9)).toNumber();
  if (gain.gt(ceiling)) return fail('more coins than the state can produce in the time elapsed');

  // Diplomas only come from graduating, and one graduation pays at most what the run's coins are worth.
  if (diplomasDone > 0) {
    if (graduationsDone <= 0) return fail('diplomas without a graduation');
    const { base, exponent } = content.balance.graduation;
    const perRun = runPool.div(Decimal.max(parseDecimal(base), 1)).pow(exponent);
    const bound = perRun.mul(bestNumber((r) => r.diplomaGain)).toNumber() * graduationsDone ** (1 - exponent) + 1;
    if (Number.isFinite(bound) && diplomasDone > bound) return fail('more diplomas than the run was worth');
  }

  return { ok: true, ratio };
}


/**
 * True when `next` is older progress than `previous` (less coins, fewer clicks, graduations or
 * diplomas): what a player gets by choosing the other device's save after a conflict. Such a
 * save has no baseline to be compared with and is judged like a first one.
 */
export function isRollback(previous: GameState, next: GameState): boolean {
  return (
    next.lifetimeCoins.lt(previous.lifetimeCoins.mul(1 - BACKWARDS_TOLERANCE)) ||
    next.counters.clicks < previous.counters.clicks ||
    next.counters.graduations < previous.counters.graduations ||
    next.diplomasEarned < previous.diplomasEarned
  );
}
