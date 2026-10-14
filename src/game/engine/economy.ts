import { PROFESSOR_IDS } from '../content/types';
import type { ClickUpgradeDef, DisciplineDef, GameContent } from '../content/types';
import { Decimal, ZERO, parseDecimal } from './decimal';
import { milestoneMultiplier } from './formulas';
import type { GameState } from './state';
import { discMult } from './stats';
import type { Stats } from './stats';

export function levelOf(state: GameState, id: string): number {
  return state.levels[id] ?? 0;
}

export function hiredCount(state: GameState): number {
  let count = 0;
  for (const id of PROFESSOR_IDS) if (state.hired[id]) count += 1;
  return count;
}

/** Everything in a discipline's output except baseProduction x level x milestones. */
export function disciplineMultiplier(state: GameState, stats: Stats, def: DisciplineDef, hired = hiredCount(state)): number {
  const others = hired - (state.hired[def.professor] ? 1 : 0);
  return (
    discMult(stats, def.id) *
    stats.prof[def.professor] *
    stats.idlePower *
    stats.globalPower *
    (state.activeProfessor === def.professor ? stats.activeBonus : 1) *
    (1 + stats.synergy * Math.max(0, others))
  );
}

/**
 * Coins/second of one discipline at `level`:
 * baseProduction x level x 2^milestones x disc x prof x idlePower x globalPower
 *   x (on stage ? activeBonus : 1) x (1 + synergy x other hired professors)
 */
export function disciplineProduction(
  state: GameState,
  content: GameContent,
  stats: Stats,
  def: DisciplineDef,
  level: number = levelOf(state, def.id),
  hired = hiredCount(state),
): Decimal {
  if (level <= 0) return ZERO;
  return parseDecimal(def.baseProduction)
    .mul(level)
    .mul(milestoneMultiplier(level, content.balance))
    .mul(disciplineMultiplier(state, stats, def, hired));
}

export function coinsPerSecondWith(state: GameState, content: GameContent, stats: Stats): Decimal {
  const hired = hiredCount(state);
  let total = ZERO;
  for (const def of content.disciplines) {
    const level = levelOf(state, def.id);
    if (level > 0) total = total.add(disciplineProduction(state, content, stats, def, level, hired));
  }
  return total;
}

/** Coins per click one click upgrade contributes at `level`, with click and global multipliers. */
export function clickUpgradeOutput(
  content: GameContent,
  stats: Stats,
  def: ClickUpgradeDef,
  level: number,
): Decimal {
  if (level <= 0) return ZERO;
  return parseDecimal(def.baseClick)
    .mul(level)
    .mul(milestoneMultiplier(level, content.balance))
    .mul(stats.clickPower)
    .mul(stats.globalPower);
}

export function comboMultiplier(stats: Stats, steps: number): number {
  return 1 + Math.max(0, steps) * stats.comboStep;
}

/** (baseClick + click upgrades) x clickPower x globalPower, before combo, crit and clickFromIdle. */
export function clickBase(state: GameState, content: GameContent, stats: Stats): Decimal {
  let upgrades = ZERO;
  for (const def of content.clickUpgrades) {
    const level = levelOf(state, def.id);
    if (level > 0) {
      upgrades = upgrades.add(
        parseDecimal(def.baseClick).mul(level).mul(milestoneMultiplier(level, content.balance)),
      );
    }
  }
  return upgrades.add(content.balance.baseClick).mul(stats.clickPower).mul(stats.globalPower);
}

export interface ClickOptions {
  comboSteps?: number;
  crit?: boolean;
}

/**
 * Value of one click:
 * (baseClick + click upgrades) x clickPower x globalPower x comboMult x (crit ? critMult : 1)
 *   + clickFromIdle x coinsPerSecond
 */
export function clickValueWith(
  state: GameState,
  content: GameContent,
  stats: Stats,
  opts: ClickOptions = {},
): Decimal {
  let value = clickBase(state, content, stats)
    .mul(comboMultiplier(stats, opts.comboSteps ?? 0))
    .mul(opts.crit ? stats.critMult : 1);
  if (stats.clickFromIdle > 0) {
    value = value.add(coinsPerSecondWith(state, content, stats).mul(stats.clickFromIdle));
  }
  return value;
}

/** Credits coins to the wallet, the run and the lifetime total, and to a running earn-seconds sprint. */
export function gain(state: GameState, amount: Decimal): void {
  if (amount.lte(0)) return;
  state.coins = state.coins.add(amount);
  state.runCoins = state.runCoins.add(amount);
  state.lifetimeCoins = state.lifetimeCoins.add(amount);

  const sprint = state.sprint.active;
  if (sprint?.refCps) {
    const reference = parseDecimal(sprint.refCps);
    if (reference.gt(0)) sprint.progress += amount.div(reference).toNumber();
  }
}

export function spend(state: GameState, cost: Decimal): void {
  state.coins = Decimal.max(0, state.coins.sub(cost));
}
