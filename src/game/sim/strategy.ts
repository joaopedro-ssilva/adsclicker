import type { GameContent } from '../content/types';
import { Decimal, parseDecimal } from '../engine/decimal';
import * as engine from '../engine/actions';
import { getIndex } from '../engine/contentIndex';
import {
  clickUpgradeOutput,
  clickValueWith,
  coinsPerSecondWith,
  comboMultiplier,
  disciplineProduction,
  levelOf,
} from '../engine/economy';
import { quoteLevels } from '../engine/purchases';
import { levelledLock, researchLock } from '../engine/requirements';
import type { GameState } from '../engine/state';
import { computeStats, hasFeature } from '../engine/stats';
import type { Stats } from '../engine/stats';
import { graduationPreview, prestigeNodeViews, professorViews } from '../engine/views';
import type { Emit } from '../store/types';

export interface StrategyOptions {
  /** Player clicks per second on the professor. */
  clicksPerSecond: number;
  /** Share (0..1) of invasions the player defends. */
  defendRate: number;
  graduate: boolean;
  /** Graduate once a graduation would give at least this many diplomas... */
  graduateMinDiplomas: number;
  /** ...and at least this share of the diplomas already earned. */
  graduateGainRatio: number;
  /** Save coins for the next professor when it is affordable within this many seconds. */
  saveWindowSeconds: number;
}

export interface Env {
  state: GameState;
  content: GameContent;
  now: number;
  rng: () => number;
  emit: Emit;
}

/** An invasion the player decided about, by uid, so each is judged once. */
export type InvasionDecisions = Map<number, boolean>;

interface Candidate {
  kind: 'discipline' | 'clickUpgrade' | 'research';
  id: string;
  cost: Decimal;
  /** Coins/second equivalent gained. */
  gain: Decimal;
}

/** What a click is worth on average while the player clicks steadily: full combo, crit chance averaged in. */
function clickWorth(env: Env, stats: Stats, opts: StrategyOptions): Decimal {
  const crit = 1 + stats.critChance * (stats.critMult - 1);
  return clickValueWith(env.state, env.content, stats, { comboSteps: stats.comboMax }).mul(crit * opts.clicksPerSecond);
}

/** Coins/second equivalent: production plus steady clicking. */
function income(env: Env, stats: Stats, opts: StrategyOptions): Decimal {
  return coinsPerSecondWith(env.state, env.content, stats).add(clickWorth(env, stats, opts));
}

function researchGain(env: Env, id: string, opts: StrategyOptions, base: Decimal): Decimal {
  const { state } = env;
  state.research[id] = true;
  const after = income(env, computeStats(state, env.content), opts);
  delete state.research[id];
  return after.sub(base);
}

function candidates(env: Env, opts: StrategyOptions, stats: Stats, base: Decimal): Candidate[] {
  const { state, content } = env;
  const index = getIndex(content);
  const list: Candidate[] = [];
  const comboCrit = comboMultiplier(stats, stats.comboMax) * (1 + stats.critChance * (stats.critMult - 1));

  for (const def of content.disciplines) {
    if (levelledLock(state, content, { kind: 'discipline', def }) !== null) continue;
    const level = levelOf(state, def.id);
    const gain = disciplineProduction(state, content, stats, def, level + 1).sub(disciplineProduction(state, content, stats, def, level));
    list.push({ kind: 'discipline', id: def.id, cost: quoteLevels(state, content, stats, def.id, 1).cost, gain });
  }
  for (const def of content.clickUpgrades) {
    if (levelledLock(state, content, { kind: 'clickUpgrade', def }) !== null) continue;
    const level = levelOf(state, def.id);
    const perClick = clickUpgradeOutput(content, stats, def, level + 1).sub(clickUpgradeOutput(content, stats, def, level));
    list.push({
      kind: 'clickUpgrade',
      id: def.id,
      cost: quoteLevels(state, content, stats, def.id, 1).cost,
      gain: perClick.mul(comboCrit * opts.clicksPerSecond),
    });
  }
  for (const def of index.research.values()) {
    if (state.research[def.id] || researchLock(state, content, def) !== null) continue;
    let gain = researchGain(env, def.id, opts, base);
    // Research that does not move income (abilities, events, discounts) is worth a small slice of it.
    if (gain.lte(0)) gain = base.mul(0.01);
    list.push({ kind: 'research', id: def.id, cost: parseDecimal(def.cost), gain });
  }
  return list;
}

function buy(env: Env, candidate: Candidate): boolean {
  const { state, content, now, emit } = env;
  switch (candidate.kind) {
    case 'discipline':
      return engine.buyDiscipline(state, content, candidate.id, now, emit);
    case 'clickUpgrade':
      return engine.buyClickUpgrade(state, content, candidate.id, now, emit);
    case 'research':
      return engine.buyResearch(state, content, candidate.id, now, emit);
  }
}

/** Hires the next professor as soon as it is affordable. */
export function hireIfAffordable(env: Env): boolean {
  const next = professorViews(env.state, env.content).find((p) => p.canBeHired && p.affordable);
  return next ? engine.hireProfessor(env.state, env.content, next.id, env.now, env.emit) : false;
}

/**
 * Buys, one at a time, the affordable purchase with the best payback (cost / income gained).
 * While saving for a professor that is close, only purchases that repay themselves before the hire.
 */
export function spendGreedily(env: Env, opts: StrategyOptions): void {
  const { state, content } = env;
  for (let guard = 0; guard < 60; guard += 1) {
    if (hireIfAffordable(env)) continue;

    const stats = computeStats(state, content);
    const base = income(env, stats, opts);
    const nextHire = professorViews(state, content).find((p) => p.canBeHired && !p.affordable);
    let deadline: Decimal | null = null;
    if (nextHire && base.gt(0)) {
      const wait = nextHire.hireCost.sub(state.coins).div(base);
      if (wait.lte(opts.saveWindowSeconds)) deadline = wait;
    }

    let best: Candidate | null = null;
    let bestPayback: Decimal | null = null;
    for (const candidate of candidates(env, opts, stats, base)) {
      if (candidate.gain.lte(0) || candidate.cost.gt(state.coins)) continue;
      const payback = candidate.cost.div(candidate.gain);
      if (deadline && payback.gt(deadline)) continue;
      if (!bestPayback || payback.lt(bestPayback)) {
        best = candidate;
        bestPayback = payback;
      }
    }
    if (!best || !buy(env, best)) return;
  }
}

/** Defends the invasion on stage with probability defendRate, deciding once per invasion. */
export function handleInvasion(env: Env, opts: StrategyOptions, decisions: InvasionDecisions): void {
  const invasion = env.state.invasion;
  if (!invasion) return;
  let defend = decisions.get(invasion.uid);
  if (defend === undefined) {
    defend = env.rng() < opts.defendRate;
    decisions.set(invasion.uid, defend);
  }
  if (!defend) return;
  for (let i = invasion.clicksLeft; i > 0; i -= 1) engine.hitInvasion(env.state, env.content, env.now, env.rng, env.emit);
}

/** Uses every ability that is ready. */
export function activateReadyAbilities(env: Env): void {
  for (const def of env.content.abilities) engine.activateAbility(env.state, env.content, def.id, env.now, env.emit);
}

/** Takes the first sprint on offer. */
export function takeSprint(env: Env): void {
  const { state } = env;
  if (state.sprint.active) return;
  const offer = state.sprint.offers[0];
  if (offer) engine.acceptSprint(state, env.content, offer, env.now, env.emit);
}

/** Spends diplomas on the cheapest available prestige node until none is affordable. */
export function spendDiplomas(env: Env): void {
  for (let guard = 0; guard < 200; guard += 1) {
    const options = prestigeNodeViews(env.state, env.content).filter((n) => n.affordable);
    const cheapest = options.sort((a, b) => a.cost - b.cost)[0];
    if (!cheapest || !engine.buyPrestigeNode(env.state, env.content, cheapest.id, env.now, env.emit)) return;
  }
}

/** Graduates when the diplomas on offer are meaningful. Returns true when it did. */
export function graduateIfWorth(env: Env, opts: StrategyOptions): boolean {
  const { state, content } = env;
  if (!opts.graduate || !hasFeature(state, content, 'graduation')) return false;
  const preview = graduationPreview(state, content);
  const wanted = Math.max(opts.graduateMinDiplomas, Math.ceil(opts.graduateGainRatio * state.diplomasEarned), 1);
  if (!preview.canGraduate || preview.diplomas < wanted) return false;
  if (!engine.graduate(state, content, env.now, env.emit)) return false;
  spendDiplomas(env);
  return true;
}
