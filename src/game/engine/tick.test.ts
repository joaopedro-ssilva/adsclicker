import { describe, expect, it } from 'vitest';
import { disciplineProduction } from './economy';
import { coinsPerSecond } from './views';
import { computeStats } from './stats';
import { advance } from './tick';
import { eventsOf, hire, newCleanGame, num, T0 } from './__fixtures__/helpers';

describe('production', () => {
  it('pays coins per second by real elapsed time', () => {
    const g = newCleanGame();
    g.state.levels['cafe'] = 10; // 1 x 10 x 2 (milestone) x 1.5 (on stage) = 30/s
    advance(g.state, g.content, T0 + 100_000, g.rng, g.emit);
    expect(num(g.state.coins)).toBeCloseTo(3000, 4);
    expect(num(g.state.runCoins)).toBeCloseTo(3000, 4);
    expect(num(g.state.lifetimeCoins)).toBeCloseTo(3000, 4);
    expect(g.state.lastTickAt).toBe(T0 + 100_000);
  });

  it('follows the production formula term by term', () => {
    const g = newCleanGame();
    hire(g.state, 'gladimir', 'angelo');
    g.state.levels['sql'] = 25; // base 3, 2 milestones -> x4
    g.state.research['r-prof-gladimir'] = true; // prof x4
    g.state.research['r-global'] = true; // global x4
    g.state.activeProfessor = 'gladimir'; // x1.5
    g.state.diplomasEarned = 5; // x1.1
    // synergy: 5% x (2 other hired professors)
    const stats = computeStats(g.state, g.content);
    const sql = g.content.disciplines.find((d) => d.id === 'sql')!;
    const expected = 3 * 25 * 4 * 4 * 4 * 1.1 * 1.5 * (1 + 0.05 * 2);
    expect(num(disciplineProduction(g.state, g.content, stats, sql))).toBeCloseTo(expected, 6);
    expect(num(coinsPerSecond(g.state, g.content))).toBeCloseTo(expected, 6);
  });

  it('is correct for a huge gap in a single step', () => {
    const g = newCleanGame();
    g.state.levels['cafe'] = 10;
    const day = 24 * 3600 * 1000;
    advance(g.state, g.content, T0 + 7 * day, g.rng, g.emit);
    expect(num(g.state.coins)).toBeCloseTo(30 * 7 * 86400, -2);
  });

  it('gives the same total in one step as in many small ones', () => {
    const a = newCleanGame();
    const b = newCleanGame();
    for (const g of [a, b]) {
      g.state.levels['cafe'] = 37;
      g.state.levels['sql'] = 0;
    }
    advance(a.state, a.content, T0 + 600_000, a.rng, a.emit);
    for (let t = 100; t <= 600_000; t += 100) advance(b.state, b.content, T0 + t, b.rng, b.emit);
    expect(num(a.state.coins) / num(b.state.coins)).toBeCloseTo(1, 8);
  });

  it('does nothing when the clock goes backwards, and resynchronises', () => {
    const g = newCleanGame();
    g.state.levels['cafe'] = 10;
    advance(g.state, g.content, T0 - 5000, g.rng, g.emit);
    expect(num(g.state.coins)).toBe(0);
    expect(g.state.lastTickAt).toBe(T0 - 5000);
    advance(g.state, g.content, T0 - 4000, g.rng, g.emit);
    expect(num(g.state.coins)).toBeCloseTo(30, 6);
  });

  it('counts play seconds', () => {
    const g = newCleanGame();
    advance(g.state, g.content, T0 + 2500, g.rng, g.emit);
    expect(g.state.counters.playSeconds).toBeCloseTo(2.5);
  });
});

describe('buffs in the tick', () => {
  it('uses the buff only until it ends, even inside one big step', () => {
    const g = newCleanGame();
    g.state.levels['cafe'] = 10; // 30/s
    g.state.buffs.push({
      id: 'buff-scale',
      name: 'x',
      emoji: 'x',
      effects: [{ stat: 'idlePower', op: 'mult', value: 5 }],
      startedAt: T0,
      endsAt: T0 + 10_000,
      source: 'ability',
    });
    advance(g.state, g.content, T0 + 60_000, g.rng, g.emit);
    expect(num(g.state.coins)).toBeCloseTo(10 * 150 + 50 * 30, 4);
    expect(g.state.buffs).toHaveLength(0);
    expect(eventsOf(g.events, 'buffEnd')).toEqual([{ type: 'buffEnd', id: 'buff-scale' }]);
  });

  it('keeps a buff that has not ended', () => {
    const g = newCleanGame();
    g.state.buffs.push({
      id: 'b',
      name: 'x',
      emoji: 'x',
      effects: [],
      startedAt: T0,
      endsAt: T0 + 10_000,
      source: 'invasion',
    });
    advance(g.state, g.content, T0 + 5000, g.rng, g.emit);
    expect(g.state.buffs).toHaveLength(1);
    expect(eventsOf(g.events, 'buffEnd')).toHaveLength(0);
  });
});

describe('auto clicks', () => {
  it('pays whole clicks and carries the fraction', () => {
    const g = newCleanGame();
    hire(g.state, 'gladimir');
    g.state.research['r-auto'] = true; // 2 clicks per second
    advance(g.state, g.content, T0 + 300, g.rng, g.emit);
    expect(num(g.state.coins)).toBe(0);
    expect(g.state.autoClickCarry).toBeCloseTo(0.6);
    advance(g.state, g.content, T0 + 600, g.rng, g.emit);
    expect(num(g.state.coins)).toBe(1);
    expect(g.state.autoClickCarry).toBeCloseTo(0.2);
    advance(g.state, g.content, T0 + 10_600, g.rng, g.emit);
    expect(num(g.state.coins)).toBe(21);
  });

  it('are plain clicks: no combo, no crit, not counted as player clicks', () => {
    const g = newCleanGame();
    hire(g.state, 'gladimir');
    g.state.research['r-auto'] = true;
    g.state.combo.steps = 10;
    g.state.combo.lastClickAt = T0;
    advance(g.state, g.content, T0 + 1000, () => 0, g.emit);
    const [event] = eventsOf(g.events, 'click');
    expect(event).toMatchObject({ auto: true, crit: false, comboSteps: 0 });
    expect(num(event!.value)).toBe(2);
    expect(g.state.counters.clicks).toBe(0);
  });
});

describe('achievement scan throttle', () => {
  it('scans the achievements about once per second', () => {
    const g = newCleanGame((c) => {
      c.achievements = [
        { id: 'a', family: 'click', name: 'a', emoji: 'a', description: 'a', condition: { kind: 'counter', counter: 'clicks', gte: 1 } },
      ];
    });
    advance(g.state, g.content, T0 + 1000, g.rng, g.emit); // scans (first one)
    g.state.counters.clicks = 5;
    advance(g.state, g.content, T0 + 1500, g.rng, g.emit); // too soon
    expect(g.state.achievements['a']).toBeUndefined();
    advance(g.state, g.content, T0 + 2100, g.rng, g.emit);
    expect(g.state.achievements['a']).toBe(T0 + 2100);
  });
});
