import { PROFESSOR_IDS } from '../content/types';
import type { GameContent, ProfessorId } from '../content/types';
import { click } from '../engine/click';
import { Decimal } from '../engine/decimal';
import { coinsPerSecondWith, hiredCount } from '../engine/economy';
import { createInitialState } from '../engine/init';
import { createRng } from '../engine/rng';
import type { GameState } from '../engine/state';
import { computeStats } from '../engine/stats';
import { advance } from '../engine/tick';
import { graduationPreview } from '../engine/views';
import { MILESTONES } from './milestones';
import type { MilestoneDef, MilestoneId } from './milestones';
import {
  graduateIfWorth,
  handleInvasion,
  hireIfAffordable,
  spendGreedily,
  takeSprint,
  activateReadyAbilities,
} from './strategy';
import type { Env, InvasionDecisions, StrategyOptions } from './strategy';

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
}

export interface SimSample {
  seconds: number;
  coins: Decimal;
  coinsPerSecond: Decimal;
  professors: number;
  diplomasEarned: number;
  achievements: number;
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
  /** Active play seconds of the hire. A professor hired again after a graduation appears again. */
  at: number;
}

export interface SimResult {
  milestones: MilestoneResult[];
  hires: HireRecord[];
  timeline: SimSample[];
  /** Simulated seconds played. */
  seconds: number;
  options: Required<Omit<SimOptions, keyof StrategyOptions>> & StrategyOptions;
  finalState: GameState;
}

const DEFAULTS = {
  clicksPerSecond: 4,
  defendRate: 0.8,
  graduate: true,
  graduateMinDiplomas: 2,
  graduateGainRatio: 0.5,
  saveWindowSeconds: 300,
  maxSeconds: 6 * 3600,
  stepMs: 500,
  decisionMs: 1000,
  seed: 1,
  stopWhenDone: true,
  sampleSeconds: 300,
} as const;

/** Arbitrary but non-zero epoch for the simulated clock. */
const START = 1_000_000_000_000;

/**
 * Plays the game headless with a greedy strategy: buys the purchase with the best payback, hires
 * as soon as it can, clicks at a fixed rate, defends a share of the invasions, uses abilities as
 * they come off cooldown, takes sprints and graduates when the diplomas are worth it. Returns when
 * each pacing milestone of GAME_DESIGN section 7 happened.
 */
export function simulate(content: GameContent, options: SimOptions = {}): SimResult {
  const opts = { ...DEFAULTS, ...options };
  const strategy: StrategyOptions = {
    clicksPerSecond: opts.clicksPerSecond,
    defendRate: opts.defendRate,
    graduate: opts.graduate,
    graduateMinDiplomas: opts.graduateMinDiplomas,
    graduateGainRatio: opts.graduateGainRatio,
    saveWindowSeconds: opts.saveWindowSeconds,
  };

  const rng = createRng(opts.seed);
  const state = createInitialState(content, START);
  const env: Env = { state, content, now: START, rng, emit: () => undefined };
  const decisions: InvasionDecisions = new Map();
  const initialSkins = Object.keys(state.skins).length;

  const reached = new Map<MilestoneId, number>();
  const timeline: SimSample[] = [];
  const hires: HireRecord[] = [];
  const wasHired = { ...state.hired };
  let clickCarry = 0;
  let nextDecision = START;
  let nextSample = START;
  let now = START;

  const recordHires = () => {
    for (const id of PROFESSOR_IDS) {
      if (state.hired[id] && !wasHired[id]) hires.push({ professor: id, at: (now - START) / 1000 });
      wasHired[id] = state.hired[id];
    }
  };

  const sample = () => {
    const stats = computeStats(state, content);
    timeline.push({
      seconds: (now - START) / 1000,
      coins: state.coins,
      coinsPerSecond: coinsPerSecondWith(state, content, stats),
      professors: hiredCount(state),
      diplomasEarned: state.diplomasEarned,
      achievements: Object.keys(state.achievements).length,
    });
  };

  while (now - START < opts.maxSeconds * 1000) {
    now += opts.stepMs;
    env.now = now;
    advance(state, content, now, rng, env.emit);

    clickCarry += (opts.clicksPerSecond * opts.stepMs) / 1000;
    for (; clickCarry >= 1; clickCarry -= 1) click(state, content, now, rng, env.emit);

    if (now >= nextDecision) {
      nextDecision = now + opts.decisionMs;
      handleInvasion(env, strategy, decisions);
      activateReadyAbilities(env);
      takeSprint(env);
      hireIfAffordable(env);
      spendGreedily(env, strategy);
      recordHires(); // before a graduation resets the faculty
      graduateIfWorth(env, strategy);
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
  }
  sample();

  return {
    milestones: MILESTONES.map((m) => ({
      id: m.id,
      label: m.label,
      targetText: m.targetText,
      target: m.target,
      reachedAt: reached.get(m.id) ?? null,
    })),
    hires,
    timeline,
    seconds: (now - START) / 1000,
    options: { ...opts, ...strategy },
    finalState: state,
  };
}
