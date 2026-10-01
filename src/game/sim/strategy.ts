import type { BuffDef, Effect, GameContent, Reward, SprintDef } from '../content/types';
import { Decimal, ZERO, parseDecimal } from '../engine/decimal';
import * as engine from '../engine/actions';
import { getIndex } from '../engine/contentIndex';
import {
  clickBase,
  clickUpgradeOutput,
  coinsPerSecondWith,
  comboMultiplier,
  disciplineProduction,
  levelOf,
} from '../engine/economy';
import { bulkCost, nextMilestone } from '../engine/formulas';
import { quoteLevels } from '../engine/purchases';
import { isAbilityUnlocked, levelledLock, researchLock } from '../engine/requirements';
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
  /** Stop graduating after this many graduations (to measure what a long final run reaches). */
  graduateUntil: number;
  /** Save coins for the next professor when it is affordable within this many seconds. */
  saveWindowSeconds: number;
  /** A purchase is worth waiting for when its price is within this many seconds of income. */
  patienceSeconds: number;
}

/** What a purchase or a tree node was, for the audit tables. */
export interface PurchaseRecord {
  kind: 'discipline' | 'clickUpgrade' | 'research' | 'prestigeNode' | 'hire';
  id: string;
  /** Seconds since the start of the simulation. */
  at: number;
  levels: number;
  cost: Decimal;
  /** Estimated income gain (coins/second equivalent). Zero when it does not move income. */
  gain: Decimal;
  /** Income equivalent at the time (coins/second). */
  income: Decimal;
}

/** Things the player remembers between decisions. */
export interface Memory {
  /** Levels bought per second, smoothed over about two minutes. */
  levelRate: number;
  lastLevels: number;
  lastAt: number;
}

export interface Env {
  state: GameState;
  content: GameContent;
  now: number;
  rng: () => number;
  emit: Emit;
  memory: Memory;
  /** Simulation epoch, to turn `now` into seconds. */
  start: number;
  onPurchase?: (record: PurchaseRecord) => void;
}

/** An invasion the player decided about, by uid, so each is judged once. */
export type InvasionDecisions = Map<number, boolean>;

// ---------------------------------------------------------------------------
// Income model: what a stretch of play is worth in coins per second. It is the player's
// "feeling" of what a purchase brings, so it has to know about clicks, crits, auto-clicks,
// buffs, invasions and sprints, not only about the disciplines.
// ---------------------------------------------------------------------------

export interface IncomeParts {
  production: Decimal;
  click: Decimal;
  auto: Decimal;
  abilities: Decimal;
  events: Decimal;
  sprints: Decimal;
  total: Decimal;
}

/** Combo saturates when the player clicks inside the window (1.5 s by default). */
function steadyCombo(env: Env, stats: Stats, opts: StrategyOptions): number {
  const window = env.content.balance.combo.windowMs / 1000;
  return opts.clicksPerSecond * window >= 1 ? stats.comboMax : 0;
}

function clickRate(env: Env, stats: Stats, opts: StrategyOptions, cps: Decimal): Decimal {
  const crit = 1 + stats.critChance * (stats.critMult - 1);
  const base = clickBase(env.state, env.content, stats);
  const perClick = base.mul(comboMultiplier(stats, steadyCombo(env, stats, opts))).mul(crit).add(cps.mul(stats.clickFromIdle));
  return perClick.mul(opts.clicksPerSecond);
}

function autoRate(env: Env, stats: Stats, cps: Decimal): Decimal {
  if (stats.autoClicks <= 0) return ZERO;
  return clickBase(env.state, env.content, stats).add(cps.mul(stats.clickFromIdle)).mul(stats.autoClicks);
}

/** Extra coins/second while a buff is on, from its effects (production, clicks, auto-clicks). */
function buffBonus(effects: readonly Effect[], cps: Decimal, click: Decimal, perClickAuto: Decimal): Decimal {
  let bonus = ZERO;
  for (const effect of effects) {
    if (effect.stat === 'idlePower' && effect.op === 'mult') bonus = bonus.add(cps.mul(effect.value - 1));
    if (effect.stat === 'globalPower' && effect.op === 'mult') bonus = bonus.add(cps.add(click).mul(effect.value - 1));
    if (effect.stat === 'clickPower' && effect.op === 'mult') bonus = bonus.add(click.mul(effect.value - 1));
    if (effect.stat === 'autoClicks' && effect.op === 'add') bonus = bonus.add(perClickAuto.mul(effect.value));
  }
  return bonus;
}

function buffValue(buff: BuffDef, stats: Stats, cps: Decimal, click: Decimal, perClickAuto: Decimal): Decimal {
  return buffBonus(buff.effects, cps, click, perClickAuto).mul((buff.durationMs / 1000) * stats.abilityDuration);
}

function rewardValue(env: Env, reward: Reward, stats: Stats, cps: Decimal, click: Decimal, perClickAuto: Decimal, source: 'invasion' | 'sprint'): Decimal {
  if (reward.kind === 'buff') return buffValue(reward.buff, stats, cps, click, perClickAuto);
  const floor = clickBase(env.state, env.content, stats).mul(env.content.balance.rewardClickFloor);
  const multiplier = source === 'invasion' ? stats.eventReward : stats.sprintReward;
  return Decimal.max(cps.mul(reward.seconds), floor).mul(multiplier);
}

function eventsRate(env: Env, stats: Stats, opts: StrategyOptions, cps: Decimal, click: Decimal, perClickAuto: Decimal): Decimal {
  if (!hasFeature(env.state, env.content, 'events')) return ZERO;
  const { minIntervalMs, maxIntervalMs } = env.content.balance.events;
  const interval = ((minIntervalMs + maxIntervalMs) / 2000) * stats.eventInterval;
  let weight = 0;
  let total = ZERO;
  for (const def of env.content.invasions) {
    weight += def.weight;
    total = total.add(rewardValue(env, def.reward, stats, cps, click, perClickAuto, 'invasion').mul(def.weight));
  }
  if (weight <= 0 || interval <= 0) return ZERO;
  return total.div(weight).mul(opts.defendRate).div(interval);
}

/** How long the player needs to finish a sprint, in seconds, or Infinity when he would not try. */
/** The part of the income a sprint estimate needs: production and everything but the sprints. */
interface Base {
  production: Decimal;
  total: Decimal;
}

export function sprintSeconds(env: Env, def: SprintDef, stats: Stats, opts: StrategyOptions, base?: Base): number {
  const goal = def.goal;
  const { balance } = env.content;
  const cps = opts.clicksPerSecond;
  switch (goal.kind) {
    case 'clicks':
      return cps > 0 ? goal.amount / cps : Infinity;
    case 'crits': {
      const rate = cps * stats.critChance;
      return rate > 0 ? goal.amount / rate : Infinity;
    }
    case 'reachCombo':
      return cps * (balance.combo.windowMs / 1000) >= 1 && goal.amount <= stats.comboMax ? goal.amount / cps + 2 : Infinity;
    case 'buyLevels': {
      // He would spend on the cheapest levels: the coins in hand and the income pay for them.
      const cheapest = cheapestLevel(env, stats);
      if (!cheapest) return Infinity;
      const needed = cheapest.mul(goal.amount * 1.4).sub(env.state.coins);
      if (needed.lte(0)) return 5;
      const perSecond = (base ?? incomeParts(env, stats, opts, false)).total;
      return perSecond.gt(0) ? Math.max(5, needed.div(perSecond).toNumber()) : Infinity;
    }
    case 'defendEvents': {
      if (!hasFeature(env.state, env.content, 'events') || opts.defendRate <= 0) return Infinity;
      const { minIntervalMs, maxIntervalMs } = balance.events;
      const interval = ((minIntervalMs + maxIntervalMs) / 2000) * stats.eventInterval;
      return (goal.amount * interval) / opts.defendRate;
    }
    case 'earnSeconds': {
      const parts = base ?? incomeParts(env, stats, opts, false);
      const ref = Decimal.max(parts.production, clickBase(env.state, env.content, stats));
      if (ref.lte(0)) return Infinity;
      const perSecond = parts.total.div(ref).toNumber();
      return perSecond > 0 ? goal.amount / perSecond : Infinity;
    }
  }
}

/** Cost of the cheapest level he could buy right now, or null. */
function cheapestLevel(env: Env, stats: Stats): Decimal | null {
  let best: Decimal | null = null;
  for (const entry of getIndex(env.content).levelled.values()) {
    if (levelledLock(env.state, env.content, entry) !== null) continue;
    const cost = quoteLevels(env.state, env.content, stats, entry.def.id, 1).cost;
    if (!best || cost.lt(best)) best = cost;
  }
  return best;
}

/** While a buy-levels sprint runs, he buys the cheapest levels he can pay for. */
export function serveSprint(env: Env): void {
  const { state, content } = env;
  const active = state.sprint.active;
  if (!active) return;
  const def = getIndex(content).sprints.get(active.def);
  if (def?.goal.kind !== 'buyLevels') return;
  for (let guard = 0; guard < 200 && active.progress < active.target; guard += 1) {
    const stats = computeStats(state, content);
    let pick: { id: string; kind: 'discipline' | 'clickUpgrade'; cost: Decimal } | null = null;
    for (const entry of getIndex(content).levelled.values()) {
      if (levelledLock(state, content, entry) !== null) continue;
      const cost = quoteLevels(state, content, stats, entry.def.id, 1).cost;
      if (!pick || cost.lt(pick.cost)) pick = { id: entry.def.id, kind: entry.kind, cost };
    }
    if (!pick || pick.cost.gt(state.coins)) return;
    const previous = state.buyAmount;
    state.buyAmount = 1;
    const ok = pick.kind === 'discipline'
      ? engine.buyDiscipline(state, content, pick.id, env.now, env.emit)
      : engine.buyClickUpgrade(state, content, pick.id, env.now, env.emit);
    state.buyAmount = previous;
    if (!ok) return;
  }
}

/** The player takes a sprint only when he expects to finish it with some margin. */
export function sprintFeasible(env: Env, def: SprintDef, stats: Stats, opts: StrategyOptions, base?: Base): boolean {
  return sprintSeconds(env, def, stats, opts, base) <= (def.durationMs / 1000) * 0.8;
}

function sprintsRate(env: Env, stats: Stats, opts: StrategyOptions, cps: Decimal, click: Decimal, perClickAuto: Decimal, base: Base): Decimal {
  if (!hasFeature(env.state, env.content, 'sprints')) return ZERO;
  let value = ZERO;
  let cycle = 0;
  let count = 0;
  for (const def of env.content.sprints) {
    if (!isEligible(env, def)) continue;
    const seconds = sprintSeconds(env, def, stats, opts, base);
    if (!(seconds <= (def.durationMs / 1000) * 0.8)) continue;
    value = value.add(rewardValue(env, def.reward, stats, cps, click, perClickAuto, 'sprint'));
    cycle += seconds + env.content.balance.sprints.cooldownMs / 1000;
    count += 1;
  }
  return count > 0 && cycle > 0 ? value.div(count).div(cycle / count) : ZERO;
}

function isEligible(env: Env, def: SprintDef): boolean {
  return def.requires.every((req) => {
    switch (req.kind) {
      case 'professorHired':
        return env.state.hired[req.professor];
      case 'disciplineLevel':
        return levelOf(env.state, req.discipline) >= req.level;
      case 'research':
        return env.state.research[req.research] === true;
      case 'graduations':
        return env.state.counters.graduations >= req.count;
    }
  });
}

function abilitiesRate(env: Env, stats: Stats, cps: Decimal, click: Decimal, perClickAuto: Decimal): Decimal {
  if (!hasFeature(env.state, env.content, 'abilities')) return ZERO;
  let total = ZERO;
  for (const def of env.content.abilities) {
    if (!isAbilityUnlocked(env.state, env.content, def)) continue;
    const duration = (def.buff.durationMs / 1000) * stats.abilityDuration;
    const cooldown = Math.max(duration, (def.cooldownMs / 1000) * stats.abilityCooldown);
    total = total.add(buffBonus(def.buff.effects, cps, click, perClickAuto).mul(duration / cooldown));
  }
  return total;
}

export function incomeParts(env: Env, stats: Stats, opts: StrategyOptions, withSprints = true): IncomeParts {
  const production = coinsPerSecondWith(env.state, env.content, stats);
  const click = clickRate(env, stats, opts, production);
  const auto = autoRate(env, stats, production);
  const perClickAuto = clickBase(env.state, env.content, stats).add(production.mul(stats.clickFromIdle));
  const abilities = abilitiesRate(env, stats, production, click, perClickAuto);
  const events = eventsRate(env, stats, opts, production, click, perClickAuto);
  const partial = production.add(click).add(auto).add(abilities).add(events);
  const sprints = withSprints ? sprintsRate(env, stats, opts, production, click, perClickAuto, { production, total: partial }) : ZERO;
  const total = partial.add(sprints);
  return { production, click, auto, abilities, events, sprints, total };
}

/** Coins/second equivalent: production plus steady clicking plus what the timed layers bring. */
export function income(env: Env, stats: Stats, opts: StrategyOptions): Decimal {
  return incomeParts(env, stats, opts).total;
}

// ---------------------------------------------------------------------------
// Purchases
// ---------------------------------------------------------------------------

interface Candidate {
  kind: 'discipline' | 'clickUpgrade' | 'research';
  id: string;
  levels: number;
  cost: Decimal;
  /** Coins/second equivalent gained. */
  gain: Decimal;
}

/** Research that does not move income (hud, offline, graduation) is worth a small slice of it. */
const SLICE = 0.01;

/** What cheaper levels are worth: a discount lets the same coins buy more, a lower growth makes late levels far cheaper. */
export function discountValue(effects: readonly Effect[], base: Decimal): Decimal {
  let value = ZERO;
  for (const effect of effects) {
    if (effect.stat === 'costMult' && effect.op === 'mult' && effect.value > 0) value = value.add(base.mul((1 / effect.value - 1) * 0.8));
    if (effect.stat === 'costGrowth' && effect.op === 'add') value = value.add(base.mul(-effect.value * 30));
  }
  return value;
}

export function researchGain(env: Env, id: string, opts: StrategyOptions, base: Decimal): Decimal {
  const { state } = env;
  state.research[id] = true;
  const after = income(env, computeStats(state, env.content), opts);
  delete state.research[id];
  const def = getIndex(env.content).research.get(id);
  return after.sub(base).add(def ? discountValue(def.effects, base) : ZERO);
}

function candidates(env: Env, opts: StrategyOptions, stats: Stats, base: Decimal): Candidate[] {
  const { state, content } = env;
  const index = getIndex(content);
  const list: Candidate[] = [];
  for (const entry of index.levelled.values()) {
    if (levelledLock(state, content, entry) !== null) continue;
    const id = entry.def.id;
    const level = levelOf(state, id);
    const baseCost = index.baseCost.get(id) ?? ZERO;
    const next = nextMilestone(level, content.balance);
    const steps = new Set<number>([1]);
    if (next !== null && next - level > 1 && next - level <= 120) steps.add(next - level);

    for (const count of steps) {
      const cost = bulkCost(baseCost, level, count, stats);
      let gain: Decimal;
      if (entry.kind === 'discipline') {
        gain = disciplineProduction(state, content, stats, entry.def, level + count).sub(
          disciplineProduction(state, content, stats, entry.def, level),
        );
        if (stats.clickFromIdle > 0) gain = gain.add(gain.mul(stats.clickFromIdle * opts.clicksPerSecond));
        if (stats.autoClicks > 0) gain = gain.add(gain.mul(stats.clickFromIdle * stats.autoClicks));
      } else {
        const perClick = clickUpgradeOutput(content, stats, entry.def, level + count).sub(
          clickUpgradeOutput(content, stats, entry.def, level),
        );
        const crit = 1 + stats.critChance * (stats.critMult - 1);
        gain = perClick
          .mul(comboMultiplier(stats, steadyCombo(env, stats, opts)) * crit * opts.clicksPerSecond)
          .add(perClick.mul(stats.autoClicks));
      }
      list.push({ kind: entry.kind, id, levels: count, cost, gain });
    }
  }

  const affordableResearch = [...index.research.values()].filter(
    (def) => !state.research[def.id] && researchLock(state, content, def) === null,
  );
  for (const def of affordableResearch) {
    const cost = parseDecimal(def.cost);
    // Pricey research is only evaluated once it is close; the evaluation is the expensive part.
    if (cost.gt(state.coins.mul(50).add(base.mul(7200)))) continue;
    let gain = researchGain(env, def.id, opts, base);
    if (gain.lte(0)) gain = base.mul(SLICE);
    list.push({ kind: 'research', id: def.id, levels: 1, cost, gain });
  }
  return list;
}

function record(env: Env, entry: Omit<PurchaseRecord, 'at'>): void {
  env.onPurchase?.({ ...entry, at: (env.now - env.start) / 1000 });
}

function buy(env: Env, candidate: Candidate, base: Decimal): boolean {
  const { state, content, now, emit } = env;
  const before = state.levels[candidate.id] ?? 0;
  let bought = false;
  if (candidate.kind === 'research') {
    bought = engine.buyResearch(state, content, candidate.id, now, emit);
  } else {
    const previous = state.buyAmount;
    // Buy exactly `levels` by repeating single purchases; keeps the sim independent of the bulkBuy feature.
    state.buyAmount = 1;
    bought = true;
    for (let i = 0; i < candidate.levels; i += 1) {
      const ok = candidate.kind === 'discipline'
        ? engine.buyDiscipline(state, content, candidate.id, now, emit)
        : engine.buyClickUpgrade(state, content, candidate.id, now, emit);
      if (!ok) {
        bought = i > 0;
        break;
      }
    }
    state.buyAmount = previous;
  }
  if (bought) {
    const levels = candidate.kind === 'research' ? 1 : (state.levels[candidate.id] ?? 0) - before;
    record(env, { kind: candidate.kind, id: candidate.id, levels, cost: candidate.cost, gain: candidate.gain, income: base });
  }
  return bought;
}

/** Hires the next professor as soon as it is affordable. */
export function hireIfAffordable(env: Env): boolean {
  const next = professorViews(env.state, env.content).find((p) => p.canBeHired && p.affordable);
  if (!next) return false;
  const stats = computeStats(env.state, env.content);
  const hired = engine.hireProfessor(env.state, env.content, next.id, env.now, env.emit);
  if (hired) record(env, { kind: 'hire', id: next.id, levels: 1, cost: next.hireCost, gain: ZERO, income: coinsPerSecondWith(env.state, env.content, stats) });
  return hired;
}

/**
 * Buys, one at a time, the purchase with the best payback (cost / income gained), counting the
 * jump to the next milestone as one option. It waits for a good purchase that is close, and while
 * saving for a professor that is close it only buys what repays itself before the hire.
 */
export function spendGreedily(env: Env, opts: StrategyOptions): void {
  const { state, content } = env;
  for (let guard = 0; guard < 80; guard += 1) {
    if (hireIfAffordable(env)) continue;

    const stats = computeStats(state, content);
    const base = income(env, stats, opts);
    if (base.lte(0)) return;
    const nextHire = professorViews(state, content).find((p) => p.canBeHired && !p.affordable);
    let deadline: Decimal | null = null;
    if (nextHire) {
      const wait = nextHire.hireCost.sub(state.coins).div(base);
      if (wait.lte(opts.saveWindowSeconds)) deadline = wait;
    }

    const options = candidates(env, opts, stats, base)
      .filter((c) => c.gain.gt(0))
      .map((c) => ({ c, payback: c.cost.div(c.gain) }))
      .sort((a, b) => a.payback.cmp(b.payback));

    let acted = false;
    for (const { c, payback } of options) {
      if (deadline && payback.gt(deadline)) continue;
      if (c.cost.lte(state.coins)) {
        acted = buy(env, c, base);
        break;
      }
      // The best purchase is not affordable yet: wait for it when it is near, else look further.
      const wait = c.cost.sub(state.coins).div(base);
      if (wait.lte(opts.patienceSeconds) && wait.lte(payback)) return;
      // A big purchase is worth saving for when the wait is a small part of its payback.
      if (wait.lte(3600) && wait.mul(3).lte(payback)) return;
    }
    if (!acted) return;
  }
}

/** Buys what is dirt cheap next to the income, whatever it does (hud, offline, graduation research). */
export function buyCheapResearch(env: Env, opts: StrategyOptions): void {
  const { state, content } = env;
  const stats = computeStats(state, content);
  const base = income(env, stats, opts);
  if (base.lte(0)) return;
  const limit = base.mul(120);
  for (const def of getIndex(content).research.values()) {
    if (state.research[def.id] || researchLock(state, content, def) !== null) continue;
    const cost = parseDecimal(def.cost);
    if (cost.lte(limit) && cost.lte(state.coins)) {
      if (engine.buyResearch(state, content, def.id, env.now, env.emit)) {
        record(env, { kind: 'research', id: def.id, levels: 1, cost, gain: ZERO, income: base });
      }
    }
  }
}

export function trackLevels(env: Env, elapsedSeconds: number): void {
  const memory = env.memory;
  const levels = env.state.counters.levelsBought;
  const dt = Math.max(0.001, (env.now - memory.lastAt) / 1000);
  const rate = (levels - memory.lastLevels) / dt;
  const weight = Math.min(1, elapsedSeconds / 120);
  memory.levelRate = memory.levelRate * (1 - weight) + rate * weight;
  memory.lastLevels = levels;
  memory.lastAt = env.now;
}

// ---------------------------------------------------------------------------
// The timed layers
// ---------------------------------------------------------------------------

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

/** Takes the offered sprint with the best reward per second of effort that he expects to finish. */
export function takeSprint(env: Env, opts: StrategyOptions): void {
  const { state, content } = env;
  if (state.sprint.active || state.sprint.offers.length === 0) return;
  const stats = computeStats(state, content);
  const index = getIndex(content);
  const parts = incomeParts(env, stats, opts, false);
  const perClickAuto = clickBase(state, content, stats).add(parts.production.mul(stats.clickFromIdle));

  let best: { id: string; score: Decimal } | null = null;
  for (const id of state.sprint.offers) {
    const def = index.sprints.get(id);
    if (!def || !sprintFeasible(env, def, stats, opts, parts)) continue;
    const seconds = Math.max(5, sprintSeconds(env, def, stats, opts, parts));
    const value = rewardValue(env, def.reward, stats, parts.production, parts.click, perClickAuto, 'sprint');
    const score = value.div(seconds);
    if (!best || score.gt(best.score)) best = { id, score };
  }
  if (best) engine.acceptSprint(state, content, best.id, env.now, env.emit);
}

// ---------------------------------------------------------------------------
// Graduation and the tree
// ---------------------------------------------------------------------------

/** What a node is worth to the player, as a share of income per diploma. */
function nodeScore(env: Env, opts: StrategyOptions, id: string, base: Decimal, cost: number): number {
  const { state, content } = env;
  const def = getIndex(content).prestigeNodes.get(id);
  if (!def) return 0;
  const level = state.prestige[id] ?? 0;
  state.prestige[id] = level + 1;
  const after = income(env, computeStats(state, content), opts);
  if (level === 0) delete state.prestige[id];
  else state.prestige[id] = level;

  let fraction = base.gt(0) ? after.sub(base).add(discountValue(def.effects, base)).div(base).toNumber() : 0;
  for (const effect of def.effects) {
    if (effect.stat === 'diplomaGain') fraction += (effect.value - 1) * 0.5;
  }
  if (def.keepsProfessors) fraction += 0.05;
  if (fraction <= 0) fraction = 0.005;
  return fraction / cost;
}

/** Spends diplomas on the nodes with the best income per diploma until none is affordable. */
export function spendDiplomas(env: Env, opts: StrategyOptions, onBuy?: (id: string) => void): number {
  let options = 0;
  for (let guard = 0; guard < 400; guard += 1) {
    const views = prestigeNodeViews(env.state, env.content).filter((n) => n.affordable);
    if (guard === 0) options = views.length;
    if (views.length === 0) return options;
    const base = income(env, computeStats(env.state, env.content), opts);
    let best: { id: string; score: number } | null = null;
    for (const view of views) {
      const score = nodeScore(env, opts, view.id, base, view.cost);
      if (!best || score > best.score) best = { id: view.id, score };
    }
    if (!best || !engine.buyPrestigeNode(env.state, env.content, best.id, env.now, env.emit)) return options;
    onBuy?.(best.id);
  }
  return options;
}

export interface GraduationOutcome {
  diplomas: number;
  /** Tree nodes the player could afford right after graduating. */
  options: number;
  bought: string[];
}

/** Graduates when the diplomas on offer are meaningful. Returns what happened, or null. */
export function graduateIfWorth(env: Env, opts: StrategyOptions): GraduationOutcome | null {
  const { state, content } = env;
  if (!opts.graduate || state.counters.graduations >= opts.graduateUntil) return null;
  if (!hasFeature(state, content, 'graduation')) return null;
  const preview = graduationPreview(state, content);
  const wanted = Math.max(opts.graduateMinDiplomas, Math.ceil(opts.graduateGainRatio * state.diplomasEarned), 1);
  if (!preview.canGraduate || preview.diplomas < wanted) return null;
  if (!engine.graduate(state, content, env.now, env.emit)) return null;
  const bought: string[] = [];
  const options = spendDiplomas(env, opts, (id) => bought.push(id));
  return { diplomas: preview.diplomas, options, bought };
}
