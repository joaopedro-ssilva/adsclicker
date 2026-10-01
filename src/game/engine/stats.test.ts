import { describe, expect, it } from 'vitest';
import { computeStats, hasFeature } from './stats';
import { hire, newGame, T0 } from './__fixtures__/helpers';

describe('base stats', () => {
  it('start from the balance config for a new game', () => {
    const { state, content } = newGame();
    const stats = computeStats(state, content);
    expect(stats.globalPower).toBe(1);
    expect(stats.clickPower).toBe(1);
    expect(stats.idlePower).toBe(1);
    expect(stats.critChance).toBeCloseTo(0.03);
    expect(stats.critMult).toBe(7);
    expect(stats.comboMax).toBe(20);
    expect(stats.comboStep).toBeCloseTo(0.05);
    expect(stats.costGrowth).toBeCloseTo(1.15);
    expect(stats.costMult).toBe(1);
    expect(stats.activeBonus).toBe(1.5);
    expect(stats.autoClicks).toBe(0);
    expect(stats.clickFromIdle).toBe(0);
    expect(stats.prof.edecio).toBe(1);
  });

  it('only gives offline hours and rate once the offline feature is unlocked', () => {
    const { state, content } = newGame();
    expect(computeStats(state, content).offlineHours).toBe(0);
    expect(computeStats(state, content).offlineRate).toBe(0);
    hire(state, 'gladimir');
    expect(computeStats(state, content).offlineHours).toBe(2);
    expect(computeStats(state, content).offlineRate).toBe(0.5);
  });

  it('only gives synergy once the synergy feature is unlocked', () => {
    const { state, content } = newGame();
    expect(computeStats(state, content).synergy).toBe(0);
    hire(state, 'angelo');
    expect(computeStats(state, content).synergy).toBeCloseTo(0.05);
  });

  it('gives no crit or combo without the combo feature', () => {
    const { state, content } = newGame((c) => {
      c.professors.edecio = { ...c.professors.edecio, features: [] };
    });
    const stats = computeStats(state, content);
    expect(stats.critChance).toBe(0);
    expect(stats.comboMax).toBe(0);
  });
});

describe('effect folding', () => {
  it('sums add effects with the base, then multiplies', () => {
    const { state, content } = newGame();
    state.research['r-global'] = true; // globalPower add 1, mult 2 -> (1 + 1) * 2
    expect(computeStats(state, content).globalPower).toBe(4);
  });

  it('adds research effects to crit chance and caps it at 1', () => {
    const { state, content } = newGame((c) => {
      c.research.push({
        id: 'extra-crit',
        professor: 'edecio',
        name: 'x',
        emoji: 'x',
        description: 'x',
        cost: '1',
        effects: [{ stat: 'critChance', op: 'add', value: 5 }],
        requires: [],
      });
    });
    state.research['r-crit'] = true;
    expect(computeStats(state, content).critChance).toBeCloseTo(0.13);
    state.research['extra-crit'] = true;
    expect(computeStats(state, content).critChance).toBe(1);
  });

  it('routes prof: and disc: stats to their targets', () => {
    const { state, content } = newGame();
    state.research['r-prof-gladimir'] = true;
    state.research['r-disc-cafe'] = true;
    const stats = computeStats(state, content);
    expect(stats.prof.gladimir).toBe(4);
    expect(stats.prof.edecio).toBe(1);
    expect(stats.disc['cafe']).toBe(3);
    expect(stats.disc['sql']).toBeUndefined();
  });

  it('applies prestige nodes once per level: add x level, mult ^ level', () => {
    const { state, content } = newGame();
    state.prestige['core-power'] = 2; // globalPower mult 1.5 -> 2.25
    state.prestige['click-power'] = 3; // clickPower add 1 -> 1 + 3
    const stats = computeStats(state, content);
    expect(stats.globalPower).toBeCloseTo(2.25);
    expect(stats.clickPower).toBe(4);
  });

  it('includes active buffs', () => {
    const { state, content } = newGame();
    state.buffs.push({
      id: 'b',
      name: 'b',
      emoji: 'b',
      effects: [{ stat: 'idlePower', op: 'mult', value: 5 }],
      startedAt: T0,
      endsAt: T0 + 1000,
      source: 'ability',
    });
    expect(computeStats(state, content).idlePower).toBe(5);
  });

  it('adds achievement and diploma bonuses to globalPower', () => {
    const { state, content } = newGame();
    for (let i = 0; i < 5; i += 1) state.achievements[`a${i}`] = T0;
    state.diplomasEarned = 10;
    // (1 + 0.01 * 5) * (1 + 0.02 * 10)
    expect(computeStats(state, content).globalPower).toBeCloseTo(1.05 * 1.2);
  });

  it('never lets the cost growth fall below the minimum', () => {
    const { state, content } = newGame();
    state.research['r-complexity'] = true;
    expect(computeStats(state, content).costGrowth).toBeCloseTo(1.1);
    content.balance.minCostGrowth = 1.12;
    expect(computeStats(state, content).costGrowth).toBeCloseTo(1.12);
  });

  it('applies cost discounts', () => {
    const { state, content } = newGame();
    state.research['r-discount'] = true;
    expect(computeStats(state, content).costMult).toBe(0.5);
  });
});

describe('hasFeature', () => {
  it('is on when a hired professor lists the feature', () => {
    const { state, content } = newGame();
    expect(hasFeature(state, content, 'combo')).toBe(true);
    expect(hasFeature(state, content, 'bulkBuy')).toBe(false);
    hire(state, 'b2');
    expect(hasFeature(state, content, 'bulkBuy')).toBe(true);
    expect(hasFeature(state, content, 'hudThemes')).toBe(true);
    state.hired.b2 = false;
    expect(hasFeature(state, content, 'bulkBuy')).toBe(false);
  });
});
