import { PROFESSOR_IDS } from '../content/types';
import type { GameContent, ProfessorId } from '../content/types';
import { click } from '../engine/click';
import { Decimal, ZERO } from '../engine/decimal';
import { coinsPerSecondWith, hiredCount } from '../engine/economy';
import { createInitialState } from '../engine/init';
import { applyOffline } from '../engine/offline';
import { createRng } from '../engine/rng';
import type { GameState } from '../engine/state';
import { computeStats } from '../engine/stats';
import { advance } from '../engine/tick';
import { graduationPreview } from '../engine/views';
import type { GameEvent } from '../store/types';
import { MILESTONES } from './milestones';
import type { MilestoneDef, MilestoneId } from './milestones';
import {
  activateReadyAbilities,
  buyCheapResearch,
  graduateIfWorth,
  handleInvasion,
  hireIfAffordable,
  spendGreedily,
  takeSprint,
  trackLevels,
} from './strategy';
import type { Env, InvasionDecisions, PurchaseRecord, StrategyOptions } from './strategy';

export interface SimOptions extends Partial<StrategyOptions> {
  /** Simulated play time limit, in seconds. Default 6 hours. */
  maxSeconds?: number;
  /** Engine step, in ms. Default 500. */
  stepMs?: number;
  /** How often the player decides what to buy, in ms. Default 1000. */
  decisionMs?: number;
  seed?: number;
  /** Stop when every milestone has happened. Default true. */
  stopWhenDone?: boolean;
  /** Timeline sampling interval, in seconds. Default 300. */
  sampleSeconds?: number;
  /** A player who plays `playSeconds`, then leaves for `awaySeconds` (offline earnings), and repeats. */
  away?: { playSeconds: number; awaySeconds: number };
  /** Stops the simulation as soon as this returns true (checked every engine step). */
  until?: (state: GameState) => boolean;
  /** Runs once on the fresh state, to start a scenario from somewhere else (tests and experiments). */
  setup?: (state: GameState) => void;
}

/** Where the coins came from in a stretch of play, as shares of the total (0..1). */
export interface IncomeShares {
  production: number;
  click: number;
  auto: number;
  invasions: number;
  sprints: number;
  offline: number;
}

export interface SimSample {
  seconds: number;
  coins: Decimal;
  coinsPerSecond: Decimal;
  professors: number;
  diplomasEarned: number;
  achievements: number;
  /** Income since the previous sample. */
  shares: IncomeShares;
}

export interface MilestoneResult {
  id: MilestoneId;
  label: string;
  targetText: string;
  target: MilestoneDef['target'];
  /** Active play seconds when it happened, or null when it did not within the run. */
  reachedAt: number | null;
}

export interface HireRecord {
  professor: ProfessorId;
  /** Seconds of the hire. A professor hired again after a graduation appears again. */
  at: number;
}

/** One run: from the start (or a graduation) to the next graduation. */
export interface RunRecord {
  index: number;
  startedAt: number;
  /** Null for the run that was still going when the simulation ended. */
  endedAt: number | null;
  /** Seconds since the start of this run, by professor. */
  hires: Partial<Record<ProfessorId, number>>;
  /** Diplomas the graduation that ended this run paid (0 while open). */
  diplomas: number;
  diplomasTotal: number;
  /** Tree nodes bought right after that graduation, and how many were affordable. */
  bought: string[];
  options: number;
  /** Coins produced in the run. */
  runCoins: Decimal;
}

export interface SprintStats {
  started: number;
  done: number;
  failed: number;
}

export interface SimResult {
  milestones: MilestoneResult[];
  hires: HireRecord[];
  runs: RunRecord[];
  timeline: SimSample[];
  /** Purchases that are not plain levels: research, hires and tree nodes. */
  purchases: PurchaseRecord[];
  sprints: Record<string, SprintStats>;
  /** Achievement id -> seconds when it unlocked. */
  achievementTimes: Record<string, number>;
  /** Seconds the player spent away, if the profile leaves. */
  awaySeconds: number;
  /** Simulated seconds played. */
  seconds: number;
  options: Required<Omit<SimOptions, keyof StrategyOptions | 'away' | 'setup' | 'until'>> & StrategyOptions & Pick<SimOptions, 'away'>;
  finalState: GameState;
}

const DEFAULTS = {
  clicksPerSecond: 4,
  defendRate: 0.8,
  graduate: true,
  graduateMinDiplomas: 10,
  graduateGainRatio: 0.5,
  graduateUntil: Infinity,
  saveWindowSeconds: 300,
  patienceSeconds: 60,
  maxSeconds: 6 * 3600,
  stepMs: 500,
  decisionMs: 1000,
  seed: 1,
  stopWhenDone: true,
  sampleSeconds: 300,
} as const;

/** Arbitrary but non-zero epoch for the simulated clock. */
const START = 1_000_000_000_000;

interface Tally {
  click: Decimal;
  auto: Decimal;
  invasions: Decimal;
  sprints: Decimal;
  offline: Decimal;
}

const emptyTally = (): Tally => ({ click: ZERO, auto: ZERO, invasions: ZERO, sprints: ZERO, offline: ZERO });

function sharesBetween(a: Tally, b: Tally, lifetimeA: Decimal, lifetimeB: Decimal): IncomeShares {
  const total = lifetimeB.sub(lifetimeA);
  if (total.lte(0)) return { production: 0, click: 0, auto: 0, invasions: 0, sprints: 0, offline: 0 };
  const part = (x: Decimal, y: Decimal) => x.sub(y).div(total).toNumber();
  const click = part(b.click, a.click);
  const auto = part(b.auto, a.auto);
  const invasions = part(b.invasions, a.invasions);
  const sprints = part(b.sprints, a.sprints);
  const offline = part(b.offline, a.offline);
  return { production: Math.max(0, 1 - click - auto - invasions - sprints - offline), click, auto, invasions, sprints, offline };
}

/**
 * Plays the game headless with a patient greedy strategy: buys the purchase with the best payback,
 * hires as soon as it can, clicks at a fixed rate, defends a share of the invasions, uses abilities
 * as they come off cooldown, takes the sprints he can finish and graduates when the diplomas are
 * worth it. Returns when each pacing milestone of GAME_DESIGN section 7 happened, plus the runs,
 * the income by source and an audit trail of research and tree purchases.
 */
export function simulate(content: GameContent, options: SimOptions = {}): SimResult {
  const opts = { ...DEFAULTS, ...options };
  const strategy: StrategyOptions = {
    clicksPerSecond: opts.clicksPerSecond,
    defendRate: opts.defendRate,
    graduate: opts.graduate,
    graduateMinDiplomas: opts.graduateMinDiplomas,
    graduateGainRatio: opts.graduateGainRatio,
    graduateUntil: opts.graduateUntil,
    saveWindowSeconds: opts.saveWindowSeconds,
    patienceSeconds: opts.patienceSeconds,
  };

  const rng = createRng(opts.seed);
  const state = createInitialState(content, START);
  opts.setup?.(state);

  const tally = emptyTally();
  const sprints: Record<string, SprintStats> = {};
  const sprintStat = (id: string) => (sprints[id] ??= { started: 0, done: 0, failed: 0 });
  const emit = (event: GameEvent): void => {
    switch (event.type) {
      case 'click':
        if (event.auto) tally.auto = tally.auto.add(event.value);
        else tally.click = tally.click.add(event.value);
        break;
      case 'invasionDefended':
        if (event.reward.kind === 'coins') tally.invasions = tally.invasions.add(event.reward.amount);
        break;
      case 'sprintStart':
        sprintStat(event.def).started += 1;
        break;
      case 'sprintDone':
        sprintStat(event.def).done += 1;
        if (event.reward.kind === 'coins') tally.sprints = tally.sprints.add(event.reward.amount);
        break;
      case 'sprintFailed':
        sprintStat(event.def).failed += 1;
        break;
      case 'offline':
        tally.offline = tally.offline.add(event.coins);
        break;
      default:
        break;
    }
  };

  const purchases: PurchaseRecord[] = [];
  const env: Env = {
    state,
    content,
    now: START,
    rng,
    emit,
    start: START,
    memory: { levelRate: 0, lastLevels: 0, lastAt: START },
    onPurchase: (record) => {
      if (record.kind !== 'discipline' && record.kind !== 'clickUpgrade') purchases.push(record);
    },
  };
  const decisions: InvasionDecisions = new Map();
  const initialSkins = Object.keys(state.skins).length;

  const reached = new Map<MilestoneId, number>();
  const timeline: SimSample[] = [];
  const hires: HireRecord[] = [];
  const runs: RunRecord[] = [];
  const wasHired = { ...state.hired };
  let run: RunRecord = newRun(0, 0);
  runs.push(run);
  let clickCarry = 0;
  let nextDecision = START;
  let nextSample = START;
  let now = START;
  let awayTotal = 0;
  let nextAway = opts.away ? START + opts.away.playSeconds * 1000 : Infinity;
  let lastTally = emptyTally();
  let lastLifetime = state.lifetimeCoins;

  function newRun(index: number, startedAt: number): RunRecord {
    return { index, startedAt, endedAt: null, hires: {}, diplomas: 0, diplomasTotal: 0, bought: [], options: 0, runCoins: ZERO };
  }

  const recordHires = () => {
    for (const id of PROFESSOR_IDS) {
      if (state.hired[id] && !wasHired[id]) {
        const at = (now - START) / 1000;
        hires.push({ professor: id, at });
        run.hires[id] = at - run.startedAt;
      }
      wasHired[id] = state.hired[id];
    }
  };

  const sample = () => {
    const stats = computeStats(state, content);
    const snapshot: Tally = { ...tally };
    timeline.push({
      seconds: (now - START) / 1000,
      coins: state.coins,
      coinsPerSecond: coinsPerSecondWith(state, content, stats),
      professors: hiredCount(state),
      diplomasEarned: state.diplomasEarned,
      achievements: Object.keys(state.achievements).length,
      shares: sharesBetween(lastTally, snapshot, lastLifetime, state.lifetimeCoins),
    });
    lastTally = snapshot;
    lastLifetime = state.lifetimeCoins;
  };

  while (now - START < opts.maxSeconds * 1000) {
    if (now >= nextAway && opts.away) {
      now += opts.away.awaySeconds * 1000;
      awayTotal += opts.away.awaySeconds;
      env.now = now;
      applyOffline(state, content, now, emit);
      nextAway = now + opts.away.playSeconds * 1000;
      nextDecision = now;
    }

    now += opts.stepMs;
    env.now = now;
    advance(state, content, now, rng, emit);

    clickCarry += (opts.clicksPerSecond * opts.stepMs) / 1000;
    for (; clickCarry >= 1; clickCarry -= 1) click(state, content, now, rng, emit);

    handleInvasion(env, strategy, decisions);

    if (now >= nextDecision) {
      nextDecision = now + opts.decisionMs;
      trackLevels(env, opts.decisionMs / 1000);
      activateReadyAbilities(env);
      takeSprint(env, strategy);
      hireIfAffordable(env);
      spendGreedily(env, strategy);
      buyCheapResearch(env, strategy);
      recordHires(); // before a graduation resets the faculty

      const runCoins = state.runCoins;
      const outcome = graduateIfWorth(env, strategy);
      if (outcome) {
        run.endedAt = (now - START) / 1000;
        run.diplomas = outcome.diplomas;
        run.diplomasTotal = state.diplomasEarned;
        run.bought = outcome.bought;
        run.options = outcome.options;
        run.runCoins = runCoins;
        run = newRun(runs.length, run.endedAt);
        runs.push(run);
        nextDecision = now; // the next decision happens at once, on the fresh run
        for (const id of PROFESSOR_IDS) {
          wasHired[id] = state.hired[id];
          if (state.hired[id] && id !== PROFESSOR_IDS[0]) run.hires[id] = 0;
        }
      }
    }

    recordHires();

    const context = { initialSkins, pendingDiplomas: graduationPreview(state, content).diplomas };
    for (const milestone of MILESTONES) {
      if (!reached.has(milestone.id) && milestone.reached(state, context)) reached.set(milestone.id, (now - START) / 1000);
    }

    if (now >= nextSample) {
      sample();
      nextSample = now + opts.sampleSeconds * 1000;
    }
    if (opts.stopWhenDone && reached.size === MILESTONES.length) break;
    if (opts.until?.(state)) break;
  }
  sample();
  run.runCoins = state.runCoins;

  const achievementTimes: Record<string, number> = {};
  for (const id in state.achievements) achievementTimes[id] = ((state.achievements[id] ?? START) - START) / 1000;

  return {
    milestones: MILESTONES.map((m) => ({
      id: m.id,
      label: m.label,
      targetText: m.targetText,
      target: m.target,
      reachedAt: reached.get(m.id) ?? null,
    })),
    hires,
    runs,
    timeline,
    purchases,
    sprints,
    achievementTimes,
    awaySeconds: awayTotal,
    seconds: (now - START) / 1000,
    options: { ...opts, ...strategy },
    finalState: state,
  };
}
