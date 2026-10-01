import { describe, expect, it } from 'vitest';
import { triggerSecret } from './actions';
import { checkAchievements } from './achievements';
import { Decimal } from './decimal';
import { computeStats } from './stats';
import { achievementViews } from './views';
import { eventsOf, hire, newGame, T0 } from './__fixtures__/helpers';

/** Content with no click-based noise: only the achievement under test is relevant. */
function check(g: ReturnType<typeof newGame>, now = T0 + 5000): string[] {
  return checkAchievements(g.state, g.content, now, g.emit);
}

describe('conditions', () => {
  it('counter', () => {
    const g = newGame();
    g.state.counters.clicks = 9;
    expect(check(g)).not.toContain('a-clicks');
    g.state.counters.clicks = 10;
    expect(check(g)).toContain('a-clicks');
  });

  it('lifetimeCoins', () => {
    const g = newGame();
    g.state.lifetimeCoins = new Decimal(999);
    expect(check(g)).not.toContain('a-lifetime');
    g.state.lifetimeCoins = new Decimal(1000);
    expect(check(g)).toContain('a-lifetime');
  });

  it('coinsPerSecond', () => {
    const g = newGame();
    g.state.levels['cafe'] = 2; // 1 x 2 x 1.5 = 3/s
    expect(check(g)).not.toContain('a-cps');
    g.state.levels['cafe'] = 7; // 10.5/s
    expect(check(g)).toContain('a-cps');
  });

  it('clickValue (without combo or crit)', () => {
    const g = newGame();
    g.state.levels['joinha'] = 3; // 1 + 3
    expect(check(g)).not.toContain('a-click-value');
    g.state.levels['joinha'] = 4; // 1 + 4 = 5
    expect(check(g)).toContain('a-click-value');
  });

  it('disciplineLevel', () => {
    const g = newGame();
    g.state.levels['cafe'] = 4;
    expect(check(g)).not.toContain('a-disc-level');
    g.state.levels['cafe'] = 5;
    expect(check(g)).toContain('a-disc-level');
  });

  it('allDisciplinesLevel', () => {
    const g = newGame();
    g.state.levels = { cafe: 5, 'muito-legal': 5 };
    expect(check(g)).not.toContain('a-all-disc');
    g.state.levels['programacao'] = 5;
    expect(check(g)).toContain('a-all-disc');
  });

  it('professorHired', () => {
    const g = newGame();
    expect(check(g)).not.toContain('a-hire-gladimir');
    hire(g.state, 'gladimir');
    expect(check(g)).toContain('a-hire-gladimir');
  });

  it('professorsHired', () => {
    const g = newGame();
    hire(g.state, 'gladimir');
    expect(check(g)).not.toContain('a-hired-3');
    hire(g.state, 'b2');
    expect(check(g)).toContain('a-hired-3');
  });

  it('allResearch', () => {
    const g = newGame();
    g.state.research = { 'r-prof-gladimir': true, 'r-offline': true };
    expect(check(g)).not.toContain('a-all-research');
    g.state.research['r-auto'] = true;
    expect(check(g)).toContain('a-all-research');
  });

  it('diplomasEarned', () => {
    const g = newGame();
    expect(check(g)).not.toContain('a-diplomas');
    g.state.diplomasEarned = 1;
    expect(check(g)).toContain('a-diplomas');
  });

  it('prestigeNodes counts nodes owned, not levels', () => {
    const g = newGame();
    expect(check(g)).not.toContain('a-nodes');
    g.state.prestige['core-power'] = 3;
    expect(check(g)).toContain('a-nodes');
  });

  it('achievements', () => {
    const g = newGame();
    g.state.achievements = { x: T0, y: T0 };
    expect(check(g)).not.toContain('a-ach-3');
    g.state.achievements['z'] = T0;
    expect(check(g)).toContain('a-ach-3');
  });

  it('skinsOwned, optionally per professor', () => {
    const g = newGame();
    expect(check(g)).not.toContain('a-skins'); // only the default skin of Edécio
    g.state.skins['edecio-cafe'] = true;
    expect(check(g)).toContain('a-skins');
  });

  it('secret fires only through triggerSecret', () => {
    const g = newGame();
    expect(check(g)).not.toContain('a-secret');
    triggerSecret(g.state, g.content, 'something-else', T0, g.emit);
    expect(g.state.achievements['a-secret']).toBeUndefined();
    triggerSecret(g.state, g.content, 'konami', T0 + 10, g.emit);
    expect(g.state.achievements['a-secret']).toBe(T0 + 10);
    expect(g.state.secrets['konami']).toBe(true);
  });
});

describe('unlocking', () => {
  it('records the time, emits the event and never unlocks twice', () => {
    const g = newGame();
    g.state.counters.clicks = 50;
    expect(check(g, T0 + 123)).toContain('a-clicks');
    expect(g.state.achievements['a-clicks']).toBe(T0 + 123);
    expect(eventsOf(g.events, 'achievement').map((e) => e.id)).toContain('a-clicks');
    const before = g.events.length;
    expect(check(g, T0 + 999)).toEqual([]);
    expect(g.events.length).toBe(before);
    expect(g.state.achievements['a-clicks']).toBe(T0 + 123);
  });

  it('grants reward cosmetics and announces each one', () => {
    const g = newGame();
    g.state.counters.clicks = 10;
    g.state.lifetimeCoins = new Decimal(5000);
    hire(g.state, 'gladimir');
    check(g);
    expect(g.state.skins['edecio-cafe']).toBe(true);
    expect(g.state.sceneries['laboratorio']).toBe(true);
    expect(g.state.themes['claro']).toBe(true);
    expect(eventsOf(g.events, 'unlock')).toEqual(
      expect.arrayContaining([
        { type: 'unlock', kind: 'skin', id: 'edecio-cafe', rarity: 'rare' },
        { type: 'unlock', kind: 'scenery', id: 'laboratorio' },
        { type: 'unlock', kind: 'theme', id: 'claro' },
      ]),
    );
  });

  it('chains: rewards can satisfy other achievements in the same scan', () => {
    const g = newGame();
    g.state.counters.clicks = 10; // -> edecio-cafe -> 2 skins -> a-skins -> edecio-chad
    check(g);
    expect(g.state.achievements['a-skins']).toBeDefined();
    expect(g.state.skins['edecio-chad']).toBe(true);
  });

  it('chains the achievement-count condition', () => {
    const g = newGame();
    g.state.counters.clicks = 10;
    g.state.lifetimeCoins = new Decimal(5000);
    g.state.levels['cafe'] = 5;
    check(g);
    expect(g.state.achievements['a-ach-3']).toBeDefined();
  });

  it('adds the production bonus per achievement', () => {
    const g = newGame();
    g.state.counters.clicks = 10;
    const unlocked = check(g);
    expect(unlocked.length).toBeGreaterThan(1);
    expect(computeStats(g.state, g.content).globalPower).toBeCloseTo(1 + 0.01 * unlocked.length);
  });
});

describe('progress', () => {
  it('reports 0..1 for measurable conditions', () => {
    const g = newGame();
    g.state.counters.clicks = 5;
    g.state.lifetimeCoins = new Decimal(250);
    g.state.levels['cafe'] = 1;
    g.state.levels['muito-legal'] = 10;
    const byId = Object.fromEntries(achievementViews(g.state, g.content).map((v) => [v.id, v]));
    expect(byId['a-clicks']!.progress).toBeCloseTo(0.5);
    expect(byId['a-lifetime']!.progress).toBeCloseTo(0.25);
    expect(byId['a-disc-level']!.progress).toBeCloseTo(0.2);
    expect(byId['a-all-disc']!.progress).toBeCloseTo((1 + 5 + 0) / 15);
    expect(byId['a-hired-3']!.progress).toBeCloseTo(1 / 3);
    expect(byId['a-all-research']!.progress).toBe(0);
    expect(byId['a-secret']!.progress).toBeNull();
  });

  it('is 1 once unlocked and carries the unlock time', () => {
    const g = newGame();
    g.state.counters.clicks = 10;
    check(g, T0 + 77);
    const view = achievementViews(g.state, g.content).find((v) => v.id === 'a-clicks')!;
    expect(view).toEqual({ id: 'a-clicks', unlocked: true, unlockedAt: T0 + 77, progress: 1 });
    const locked = achievementViews(g.state, g.content).find((v) => v.id === 'a-diplomas')!;
    expect(locked).toMatchObject({ unlocked: false, unlockedAt: null });
  });

  it('handles huge decimal conditions without overflowing', () => {
    const g = newGame((c) => {
      c.achievements = [
        { id: 'big', family: 'production', name: 'b', emoji: 'b', description: 'b', condition: { kind: 'lifetimeCoins', gte: '1e300' } },
      ];
    });
    g.state.lifetimeCoins = new Decimal('1e150');
    expect(achievementViews(g.state, g.content)[0]!.progress).toBeLessThan(1e-100);
    g.state.lifetimeCoins = new Decimal('5e299');
    expect(achievementViews(g.state, g.content)[0]!.progress).toBeCloseTo(0.5);
  });
});
