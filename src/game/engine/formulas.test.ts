import { describe, expect, it } from 'vitest';
import { Decimal } from './decimal';
import {
  bulkCost,
  levelCost,
  maxAffordable,
  milestoneMultiplier,
  milestonesCrossed,
  milestonesReached,
  nextMilestone,
  previousMilestone,
} from './formulas';
import { computeStats } from './stats';
import type { Stats } from './stats';
import { fixtureBalance } from './__fixtures__/content';
import { newGame } from './__fixtures__/helpers';

function baseStats(): Stats {
  const { state, content } = newGame();
  return computeStats(state, content);
}

describe('level cost', () => {
  it('is baseCost x growth^level, rounded up to whole coins', () => {
    const stats = baseStats();
    const base = new Decimal(10);
    expect(levelCost(base, 0, stats).toNumber()).toBeCloseTo(10);
    expect(levelCost(base, 10, stats).toNumber()).toBe(Math.ceil(10 * 1.15 ** 10));
    expect(levelCost(base, 100, stats).toNumber()).toBeCloseTo(10 * 1.15 ** 100, -3);
  });

  it('applies costMult and a changed growth', () => {
    const stats: Stats = { ...baseStats(), costMult: 0.5, costGrowth: 1.1 };
    expect(levelCost(new Decimal(100), 5, stats).toNumber()).toBe(Math.ceil(100 * 1.1 ** 5 * 0.5));
  });
});

describe('bulk cost', () => {
  it('is the rounded-up series: never above the sum of the single levels, and within one coin per level of it', () => {
    const stats = baseStats();
    const base = new Decimal(15);
    for (const [level, count] of [
      [0, 10],
      [7, 25],
      [40, 3],
    ] as const) {
      let sum = new Decimal(0);
      for (let i = 0; i < count; i += 1) sum = sum.add(levelCost(base, level + i, stats));
      const bulk = bulkCost(base, level, count, stats);
      expect(bulk.lte(sum)).toBe(true);
      expect(sum.sub(bulk).toNumber()).toBeLessThan(count);
      expect(bulk.toNumber()).toBe(Math.ceil(bulk.toNumber()));
    }
  });

  it('is the level cost for one level and zero for none', () => {
    const stats = baseStats();
    expect(bulkCost(new Decimal(10), 3, 1, stats).eq(levelCost(new Decimal(10), 3, stats))).toBe(true);
    expect(bulkCost(new Decimal(10), 3, 0, stats).toNumber()).toBe(0);
  });
});

describe('max affordable', () => {
  const stats = baseStats();
  const base = new Decimal(10);

  it('finds the exact number of levels that fit', () => {
    for (const level of [0, 12, 80]) {
      for (const count of [1, 2, 7, 33]) {
        const exact = bulkCost(base, level, count, stats);
        expect(maxAffordable(exact, base, level, stats)).toBe(count);
        expect(maxAffordable(exact.mul(0.999), base, level, stats)).toBe(count - 1);
      }
    }
  });

  it('is zero without coins or when one level is out of reach', () => {
    expect(maxAffordable(new Decimal(0), base, 0, stats)).toBe(0);
    expect(maxAffordable(new Decimal(9), base, 0, stats)).toBe(0);
  });

  it('handles huge wallets', () => {
    const wallet = new Decimal('1e120');
    const count = maxAffordable(wallet, base, 0, stats);
    expect(count).toBeGreaterThan(100);
    expect(bulkCost(base, 0, count, stats).lte(wallet)).toBe(true);
    expect(bulkCost(base, 0, count + 1, stats).gt(wallet)).toBe(true);
  });

  it('is capped when costs vanish', () => {
    expect(maxAffordable(new Decimal(5), base, 0, { ...stats, costMult: 0 })).toBeGreaterThan(1000);
  });
});

describe('milestones', () => {
  const b = fixtureBalance;

  it('counts milestones at 10, 25, 50, 100, 200 and then every 100', () => {
    const table: [number, number][] = [
      [0, 0],
      [9, 0],
      [10, 1],
      [24, 1],
      [25, 2],
      [49, 2],
      [50, 3],
      [99, 3],
      [100, 4],
      [199, 4],
      [200, 5],
      [299, 5],
      [300, 6],
      [399, 6],
      [400, 7],
      [1000, 13],
    ];
    for (const [level, reached] of table) expect(milestonesReached(level, b), `level ${level}`).toBe(reached);
  });

  it('doubles the output per milestone', () => {
    expect(milestoneMultiplier(9, b).toNumber()).toBe(1);
    expect(milestoneMultiplier(10, b).toNumber()).toBe(2);
    expect(milestoneMultiplier(25, b).toNumber()).toBe(4);
    expect(milestoneMultiplier(300, b).toNumber()).toBe(64);
  });

  it('finds the next and previous milestone', () => {
    expect(nextMilestone(0, b)).toBe(10);
    expect(nextMilestone(10, b)).toBe(25);
    expect(nextMilestone(199, b)).toBe(200);
    expect(nextMilestone(200, b)).toBe(300);
    expect(nextMilestone(250, b)).toBe(300);
    expect(nextMilestone(300, b)).toBe(400);
    expect(previousMilestone(5, b)).toBe(0);
    expect(previousMilestone(30, b)).toBe(25);
    expect(previousMilestone(350, b)).toBe(300);
  });

  it('lists the milestones crossed by a purchase', () => {
    expect(milestonesCrossed(8, 30, b)).toEqual([10, 25]);
    expect(milestonesCrossed(10, 24, b)).toEqual([]);
    expect(milestonesCrossed(190, 410, b)).toEqual([200, 300, 400]);
  });

  it('copes with an empty milestone list or no step', () => {
    const onlyStep = { ...b, milestones: [], milestoneStep: 50 };
    expect(milestonesReached(120, onlyStep)).toBe(2);
    expect(nextMilestone(120, onlyStep)).toBe(150);
    const noStep = { ...b, milestoneStep: 0 };
    expect(nextMilestone(200, noStep)).toBeNull();
    expect(milestonesReached(5000, noStep)).toBe(5);
  });
});
