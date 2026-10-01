import { describe, expect, it } from 'vitest';
import { click } from './click';
import { Decimal } from './decimal';
import { advance } from './tick';
import { eventsOf, hire, newGame, num, T0 } from './__fixtures__/helpers';

const never = () => 0.99; // never crits
const always = () => 0; // always crits

describe('click', () => {
  it('pays the base click value and counts it', () => {
    const g = newGame();
    click(g.state, g.content, T0, never, g.emit);
    expect(num(g.state.coins)).toBe(1);
    expect(num(g.state.runCoins)).toBe(1);
    expect(num(g.state.lifetimeCoins)).toBe(1);
    expect(g.state.counters.clicks).toBe(1);
    expect(g.state.combo.lastClickAt).toBe(T0);
  });

  it('emits a click event with the position', () => {
    const g = newGame();
    click(g.state, g.content, T0, never, g.emit, { x: 10, y: 20 });
    const [event] = eventsOf(g.events, 'click');
    expect(event).toMatchObject({ crit: false, auto: false, x: 10, y: 20, comboSteps: 0 });
    expect(num(event!.value)).toBe(1);
  });

  it('builds a combo with fast clicks, +5% per step up to the max', () => {
    const g = newGame((c) => {
      c.balance.achievementBonus = 0; // keep the numbers clean: no bonus from the achievements unlocked on the way
    });
    const values: number[] = [];
    for (let i = 0; i < 30; i += 1) {
      const before = g.state.coins;
      click(g.state, g.content, T0 + i * 100, never, g.emit);
      values.push(num(g.state.coins.sub(before)));
    }
    expect(values[0]).toBe(1);
    expect(values[1]).toBeCloseTo(1.05);
    expect(values[10]).toBeCloseTo(1.5);
    expect(values[20]).toBeCloseTo(2);
    expect(values[29]).toBeCloseTo(2); // capped at comboMax 20
    expect(g.state.combo.steps).toBe(20);
    expect(g.state.counters.maxCombo).toBe(20);
  });

  it('keeps the combo for the window, then decays it 5 steps per second', () => {
    const g = newGame();
    for (let i = 0; i < 11; i += 1) click(g.state, g.content, T0 + i * 100, never, g.emit);
    expect(g.state.combo.steps).toBe(10);
    const last = T0 + 1000;

    advance(g.state, g.content, last + 1500, g.rng, g.emit); // inside the window
    expect(g.state.combo.steps).toBe(10);

    advance(g.state, g.content, last + 2500, g.rng, g.emit); // one second past the window
    expect(g.state.combo.steps).toBeCloseTo(5);

    advance(g.state, g.content, last + 5000, g.rng, g.emit);
    expect(g.state.combo.steps).toBe(0);
  });

  it('starts over when the combo has fully decayed', () => {
    const g = newGame();
    for (let i = 0; i < 6; i += 1) click(g.state, g.content, T0 + i * 100, never, g.emit);
    advance(g.state, g.content, T0 + 10_000, g.rng, g.emit);
    const before = g.state.coins;
    click(g.state, g.content, T0 + 10_000, never, g.emit);
    expect(num(g.state.coins.sub(before))).toBe(1);
    expect(g.state.combo.steps).toBe(0);
  });

  it('crits with the injected rng and multiplies by critMult', () => {
    const g = newGame();
    click(g.state, g.content, T0, always, g.emit);
    expect(num(g.state.coins)).toBe(7);
    expect(g.state.counters.crits).toBe(1);
    expect(eventsOf(g.events, 'click')[0]).toMatchObject({ crit: true });
  });

  it('uses the crit chance threshold', () => {
    const g = newGame();
    click(g.state, g.content, T0, () => 0.029, g.emit);
    click(g.state, g.content, T0 + 5000, () => 0.031, g.emit);
    expect(g.state.counters.crits).toBe(1);
  });

  it('does a seeded run deterministically', () => {
    const run = () => {
      const g = newGame();
      for (let i = 0; i < 200; i += 1) click(g.state, g.content, T0 + i * 150, g.rng, g.emit);
      return [g.state.coins.toString(), g.state.counters.crits];
    };
    expect(run()).toEqual(run());
    expect(run()[1]).toBeGreaterThan(0);
  });

  it('has no combo or crit without the combo feature', () => {
    const g = newGame((c) => {
      c.professors.edecio = { ...c.professors.edecio, features: [] };
    });
    for (let i = 0; i < 5; i += 1) click(g.state, g.content, T0 + i * 100, always, g.emit);
    expect(num(g.state.coins)).toBe(5);
    expect(g.state.counters.crits).toBe(0);
    expect(g.state.combo.steps).toBe(0);
  });

  it('adds click upgrades with their milestones, times clickPower', () => {
    const g = newGame();
    g.state.levels['joinha'] = 3; // 1 base + 3 x 1
    click(g.state, g.content, T0, never, g.emit);
    expect(num(g.state.coins)).toBe(4);

    const h = newGame();
    h.state.levels['joinha'] = 10; // milestone doubles the upgrade: 1 + 10 x 2
    h.state.research['r-clickpower'] = true; // x2
    click(h.state, h.content, T0, never, h.emit);
    expect(num(h.state.coins)).toBe(42);
  });

  it('adds a share of coins/second when clickFromIdle is set', () => {
    const g = newGame((c) => {
      c.research.push({
        id: 'idle-click',
        professor: 'edecio',
        name: 'x',
        emoji: 'x',
        description: 'x',
        cost: '1',
        effects: [{ stat: 'clickFromIdle', op: 'add', value: 0.1 }],
        requires: [],
      });
    });
    g.state.levels['cafe'] = 10; // 30 coins/s on stage
    g.state.research['idle-click'] = true;
    click(g.state, g.content, T0, never, g.emit);
    expect(num(g.state.coins)).toBeCloseTo(1 + 3);
  });

  it('applies globalPower', () => {
    const g = newGame();
    g.state.research['r-global'] = true; // x4
    click(g.state, g.content, T0, never, g.emit);
    expect(num(g.state.coins)).toBe(4);
  });

  it('is exact with huge numbers', () => {
    const g = newGame();
    g.state.coins = new Decimal('1e300');
    click(g.state, g.content, T0, never, g.emit);
    expect(g.state.coins.gte('1e300')).toBe(true);
  });
});

describe('click and the second professor', () => {
  it('works the same with other professors on stage', () => {
    const g = newGame();
    hire(g.state, 'gladimir');
    g.state.activeProfessor = 'gladimir';
    click(g.state, g.content, T0, never, g.emit);
    expect(num(g.state.coins)).toBe(1);
  });
});
