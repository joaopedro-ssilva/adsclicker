import type { BalanceConfig } from '../content/types';
import { Decimal } from './decimal';
import type { Stats } from './stats';

/** Hard cap on one bulk purchase, so a free-cost edge case (costMult 0) cannot loop or overflow. */
const MAX_BULK = 100_000;

/** Cost of the next level: baseCost x growth^level x costMult. */
export function levelCost(baseCost: Decimal, level: number, stats: Stats): Decimal {
  return baseCost.mul(Decimal.pow(stats.costGrowth, level)).mul(stats.costMult);
}

/** Cost of buying `count` levels at once, from `level`. Closed-form geometric series. */
export function bulkCost(baseCost: Decimal, level: number, count: number, stats: Stats): Decimal {
  if (count <= 0) return new Decimal(0);
  if (count === 1) return levelCost(baseCost, level, stats);
  return Decimal.sumGeometricSeries(count, baseCost.mul(stats.costMult), stats.costGrowth, level);
}

/** How many levels `coins` can buy from `level`. Closed form, then corrected for float error. */
export function maxAffordable(coins: Decimal, baseCost: Decimal, level: number, stats: Stats): number {
  if (coins.lte(0)) return 0;
  if (stats.costMult <= 0) return MAX_BULK;

  const estimate = Decimal.affordGeometricSeries(coins, baseCost.mul(stats.costMult), stats.costGrowth, level).toNumber();
  let count = Number.isFinite(estimate) ? Math.min(MAX_BULK, Math.max(0, Math.floor(estimate))) : MAX_BULK;
  while (count > 0 && bulkCost(baseCost, level, count, stats).gt(coins)) count -= 1;
  while (count < MAX_BULK && bulkCost(baseCost, level, count + 1, stats).lte(coins)) count += 1;
  return count;
}

// ---------------------------------------------------------------------------
// Milestones: the output of an upgrade doubles at levels 10, 25, 50, 100, 200 and then every
// `milestoneStep` levels (BalanceConfig.milestones / milestoneStep / milestoneMult).
// ---------------------------------------------------------------------------

/** The n-th milestone level (0-based), or null when there is none. */
function milestoneAt(index: number, balance: BalanceConfig): number | null {
  const list = balance.milestones;
  const listed = list[index];
  if (listed !== undefined) return listed;
  if (balance.milestoneStep <= 0) return null;
  const last = list[list.length - 1] ?? 0;
  return last + (index - list.length + 1) * balance.milestoneStep;
}

/** How many milestones `level` has reached. */
export function milestonesReached(level: number, balance: BalanceConfig): number {
  const list = balance.milestones;
  let reached = 0;
  while (reached < list.length && (list[reached] ?? Infinity) <= level) reached += 1;
  if (reached === list.length && balance.milestoneStep > 0) {
    const last = list[list.length - 1] ?? 0;
    if (level >= last + balance.milestoneStep) reached += Math.floor((level - last) / balance.milestoneStep);
  }
  return reached;
}

/** Output multiplier from milestones: milestoneMult ^ milestonesReached. */
export function milestoneMultiplier(level: number, balance: BalanceConfig): Decimal {
  return Decimal.pow(balance.milestoneMult, milestonesReached(level, balance));
}

/** Next level that doubles the output, or null. */
export function nextMilestone(level: number, balance: BalanceConfig): number | null {
  return milestoneAt(milestonesReached(level, balance), balance);
}

/** The milestone level at or below `level` (0 when none was reached). */
export function previousMilestone(level: number, balance: BalanceConfig): number {
  const reached = milestonesReached(level, balance);
  return reached === 0 ? 0 : (milestoneAt(reached - 1, balance) ?? 0);
}

/** Milestone levels crossed when going from `from` (exclusive) to `to` (inclusive). */
export function milestonesCrossed(from: number, to: number, balance: BalanceConfig): number[] {
  const crossed: number[] = [];
  for (let i = milestonesReached(from, balance); i < milestonesReached(to, balance); i += 1) {
    const level = milestoneAt(i, balance);
    if (level !== null) crossed.push(level);
  }
  return crossed;
}
