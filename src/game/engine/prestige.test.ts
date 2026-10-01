import { describe, expect, it } from 'vitest';
import { buyPrestigeNode, graduate, setBuyAmount } from './actions';
import { Decimal } from './decimal';
import { requirementMet } from './requirements';
import { diplomasFor, prestigeNodeCost, runCoinsFor } from './prestige';
import { computeStats } from './stats';
import { graduationPreview, prestigeNodeViews } from './views';
import { eventsOf, hire, newCleanGame, num, T0 } from './__fixtures__/helpers';

function ready() {
  const g = newCleanGame();
  hire(g.state, 'gladimir', 'b2', 'angelo');
  g.state.runCoins = new Decimal(1e6);
  g.state.lifetimeCoins = new Decimal(1e6);
  g.state.coins = new Decimal(5e5);
  return g;
}

describe('diploma formula', () => {
  it('is floor((runCoins / base) ^ exponent x diplomaGain)', () => {
    const g = newCleanGame();
    const stats = computeStats(g.state, g.content);
    // base 1000, exponent 0.5
    expect(diplomasFor(new Decimal(0), g.content, stats)).toBe(0);
    expect(diplomasFor(new Decimal(999), g.content, stats)).toBe(0);
    expect(diplomasFor(new Decimal(1000), g.content, stats)).toBe(1);
    expect(diplomasFor(new Decimal(4000), g.content, stats)).toBe(2);
    expect(diplomasFor(new Decimal(1e6), g.content, stats)).toBe(31);
    expect(diplomasFor(new Decimal('1e30'), g.content, stats) / Math.sqrt(1e27)).toBeCloseTo(1, 6);
    expect(diplomasFor(new Decimal('1e100'), g.content, stats)).toBe(Number.MAX_SAFE_INTEGER); // clamped
  });

  it('scales with diplomaGain', () => {
    const g = newCleanGame();
    g.state.prestige['core-gain'] = 2; // +0.5 x 2 -> x2
    const stats = computeStats(g.state, g.content);
    expect(diplomasFor(new Decimal(4000), g.content, stats)).toBe(4);
  });

  it('inverts into the run coins needed for N diplomas', () => {
    const g = newCleanGame();
    const stats = computeStats(g.state, g.content);
    expect(num(runCoinsFor(1, g.content, stats))).toBeCloseTo(1000);
    expect(num(runCoinsFor(2, g.content, stats))).toBeCloseTo(4000);
    expect(num(runCoinsFor(10, g.content, stats))).toBeCloseTo(100_000);
    expect(num(runCoinsFor(0, g.content, stats))).toBe(0);
  });

  it('previews diplomas, the next threshold and progress', () => {
    const g = newCleanGame();
    hire(g.state, 'angelo');
    g.state.runCoins = new Decimal(2500); // 1 diploma, next at 4000
    const preview = graduationPreview(g.state, g.content);
    expect(preview.unlocked).toBe(true);
    expect(preview.diplomas).toBe(1);
    expect(num(preview.nextAt)).toBeCloseTo(4000);
    expect(preview.progress).toBeCloseTo((2500 - 1000) / 3000);
    expect(preview.canGraduate).toBe(true);
  });

  it('cannot graduate before earning a diploma or without the feature', () => {
    const g = newCleanGame();
    g.state.runCoins = new Decimal(1e6);
    expect(graduationPreview(g.state, g.content)).toMatchObject({ unlocked: false, canGraduate: false });
    hire(g.state, 'angelo');
    g.state.runCoins = new Decimal(500);
    const preview = graduationPreview(g.state, g.content);
    expect(preview).toMatchObject({ unlocked: true, diplomas: 0, canGraduate: false });
    expect(num(preview.nextAt)).toBeCloseTo(1000);
  });
});

describe('graduation', () => {
  it('refuses without Angelo or without a diploma to earn', () => {
    const g = newCleanGame();
    g.state.runCoins = new Decimal(1e6);
    expect(graduate(g.state, g.content, T0, g.emit)).toBe(false);
    hire(g.state, 'angelo');
    g.state.runCoins = new Decimal(10);
    expect(graduate(g.state, g.content, T0, g.emit)).toBe(false);
    expect(g.events).toEqual([]);
  });

  it('pays diplomas and counts the graduation', () => {
    const g = ready();
    expect(graduate(g.state, g.content, T0, g.emit)).toBe(true);
    expect(g.state.diplomas).toBe(31);
    expect(g.state.diplomasEarned).toBe(31);
    expect(g.state.counters.graduations).toBe(1);
    expect(eventsOf(g.events, 'graduate')).toEqual([{ type: 'graduate', diplomas: 31 }]);
  });

  it('resets the run: coins, levels, research, hires, buffs, invasion, sprint, combo, cooldowns', () => {
    const g = ready();
    g.state.levels = { cafe: 40, joinha: 12 };
    g.state.research = { 'r-clickpower': true };
    g.state.buyAmount = 'max';
    g.state.activeProfessor = 'gladimir';
    g.state.buffs.push({ id: 'b', name: 'b', emoji: 'b', effects: [], startedAt: T0, endsAt: T0 + 1e6, source: 'ability' });
    g.state.abilityReadyAt = { 'auto-scaling': T0 + 1e6 };
    g.state.invasion = { uid: 3, def: 'phishing', spawnedAt: T0, expiresAt: T0 + 5000, clicksLeft: 2, x: 0.5, y: 0.5 };
    g.state.nextInvasionAt = T0 + 1000;
    g.state.eventStreak = 6;
    g.state.sprint = { offers: ['spr-clicks'], active: { def: 'spr-buy', startedAt: T0, endsAt: T0 + 1000, progress: 1, target: 3 }, nextOffersAt: T0 };
    g.state.combo = { steps: 12, lastClickAt: T0 };
    g.state.autoClickCarry = 0.5;

    graduate(g.state, g.content, T0, g.emit);

    expect(num(g.state.coins)).toBe(0);
    expect(num(g.state.runCoins)).toBe(0);
    expect(g.state.levels).toEqual({});
    expect(g.state.research).toEqual({});
    expect(g.state.hired).toMatchObject({ edecio: true, gladimir: false, b2: false, angelo: false, pablo: false });
    expect(g.state.activeProfessor).toBe('edecio');
    expect(g.state.buyAmount).toBe(1);
    expect(g.state.buffs).toEqual([]);
    expect(g.state.abilityReadyAt).toEqual({});
    expect(g.state.invasion).toBeNull();
    expect(g.state.nextInvasionAt).toBe(0);
    expect(g.state.eventStreak).toBe(0);
    expect(g.state.sprint).toEqual({ offers: [], active: null, nextOffersAt: 0 });
    expect(g.state.combo).toEqual({ steps: 0, lastClickAt: 0 });
    expect(g.state.autoClickCarry).toBe(0);
  });

  it('keeps diplomas, the tree, achievements, cosmetics, counters, secrets and settings', () => {
    const g = ready();
    g.state.prestige = { 'core-power': 2 };
    g.state.achievements = { x: T0 };
    g.state.secrets = { konami: true };
    g.state.skins['edecio-cafe'] = true;
    g.state.equippedSkin.edecio = 'edecio-cafe';
    g.state.sceneries['laboratorio'] = true;
    g.state.equippedScenery = 'laboratorio';
    g.state.themes['claro'] = true;
    g.state.equippedTheme = 'claro';
    g.state.counters.clicks = 123;
    g.state.counters.professorSwaps = 4;
    g.state.diplomas = 5;
    g.state.diplomasEarned = 9;
    g.state.settings.muted = true;
    g.state.lifetimeCoins = new Decimal(7e8);

    graduate(g.state, g.content, T0, g.emit);

    expect(g.state.diplomas).toBe(5 + 31);
    expect(g.state.diplomasEarned).toBe(9 + 31);
    expect(g.state.prestige).toEqual({ 'core-power': 2 });
    expect(g.state.achievements).toEqual({ x: T0 });
    expect(g.state.secrets).toEqual({ konami: true });
    expect(g.state.equippedSkin.edecio).toBe('edecio-cafe');
    expect(g.state.skins['edecio-cafe']).toBe(true);
    expect(g.state.equippedScenery).toBe('laboratorio');
    expect(g.state.equippedTheme).toBe('claro');
    expect(g.state.counters.clicks).toBe(123);
    expect(g.state.counters.professorSwaps).toBe(4);
    expect(g.state.counters.graduations).toBe(1);
    expect(g.state.settings.muted).toBe(true);
    expect(num(g.state.lifetimeCoins)).toBe(7e8);
  });

  it('keeps the professors named by owned prestige nodes', () => {
    const g = ready();
    g.state.prestige = { 'core-power': 1, 'core-keep': 1 };
    g.state.activeProfessor = 'gladimir';
    graduate(g.state, g.content, T0, g.emit);
    expect(g.state.hired.gladimir).toBe(true);
    expect(g.state.hired.b2).toBe(false);
    expect(g.state.hired.angelo).toBe(false);
    expect(g.state.activeProfessor).toBe('gladimir');
  });

  it('gives each diploma a permanent +2% global bonus', () => {
    const g = ready();
    graduate(g.state, g.content, T0, g.emit);
    expect(computeStats(g.state, g.content).globalPower).toBeCloseTo(1 + 0.02 * 31);
  });

  it('keeps x10 / max only if the bulk feature survives', () => {
    const g = ready();
    setBuyAmount(g.state, g.content, 10);
    g.state.prestige = { 'core-power': 1, 'core-keep': 1 };
    g.state.hired.b2 = true;
    graduate(g.state, g.content, T0, g.emit);
    expect(g.state.buyAmount).toBe(1); // B2 is not kept
  });

  it('satisfies the graduation requirement of the last professor', () => {
    const g = ready();
    expect(requirementMet(g.state, { kind: 'graduations', count: 1 })).toBe(false);
    graduate(g.state, g.content, T0, g.emit);
    expect(requirementMet(g.state, { kind: 'graduations', count: 1 })).toBe(true);
  });
});

describe('prestige tree', () => {
  it('charges costGrowth ^ level diplomas, rounded up', () => {
    const node = { cost: 1, costGrowth: 2 } as Parameters<typeof prestigeNodeCost>[0];
    expect([0, 1, 2, 3].map((level) => prestigeNodeCost(node, level))).toEqual([1, 2, 4, 8]);
    const slow = { cost: 3, costGrowth: 1.5 } as Parameters<typeof prestigeNodeCost>[0];
    expect([0, 1, 2].map((level) => prestigeNodeCost(slow, level))).toEqual([3, 5, 7]);
  });

  it('buys levels up to the max, paying each level in diplomas', () => {
    const g = newCleanGame();
    g.state.diplomas = 20;
    expect(buyPrestigeNode(g.state, g.content, 'core-power', T0, g.emit)).toBe(true); // 1
    expect(buyPrestigeNode(g.state, g.content, 'core-power', T0, g.emit)).toBe(true); // 2
    expect(buyPrestigeNode(g.state, g.content, 'core-power', T0, g.emit)).toBe(true); // 4
    expect(g.state.prestige['core-power']).toBe(3);
    expect(g.state.diplomas).toBe(20 - 7);
    expect(buyPrestigeNode(g.state, g.content, 'core-power', T0, g.emit)).toBe(false); // max level 3
    expect(eventsOf(g.events, 'purchase')).toHaveLength(3);
    expect(eventsOf(g.events, 'purchase')[0]).toEqual({ type: 'purchase', kind: 'prestigeNode', id: 'core-power', levels: 1 });
  });

  it('needs the parent nodes and enough diplomas', () => {
    const g = newCleanGame();
    g.state.diplomas = 100;
    expect(buyPrestigeNode(g.state, g.content, 'click-power', T0, g.emit)).toBe(false);
    buyPrestigeNode(g.state, g.content, 'core-power', T0, g.emit);
    expect(buyPrestigeNode(g.state, g.content, 'click-power', T0, g.emit)).toBe(true);

    const poor = newCleanGame();
    poor.state.diplomas = 0;
    expect(buyPrestigeNode(poor.state, poor.content, 'core-power', T0, poor.emit)).toBe(false);
    expect(buyPrestigeNode(poor.state, poor.content, 'ghost', T0, poor.emit)).toBe(false);
  });

  it('applies the effects to the stats by level', () => {
    const g = newCleanGame();
    g.state.diplomas = 50;
    buyPrestigeNode(g.state, g.content, 'core-power', T0, g.emit);
    expect(computeStats(g.state, g.content).globalPower).toBeCloseTo(1.5);
    buyPrestigeNode(g.state, g.content, 'core-power', T0, g.emit);
    expect(computeStats(g.state, g.content).globalPower).toBeCloseTo(2.25);
  });

  it('reports node views', () => {
    const g = newCleanGame();
    g.state.diplomas = 1;
    const views = prestigeNodeViews(g.state, g.content);
    const root = views.find((v) => v.id === 'core-power')!;
    const child = views.find((v) => v.id === 'click-power')!;
    expect(root).toMatchObject({ level: 0, maxLevel: 3, cost: 1, affordable: true, available: true, maxed: false });
    expect(child).toMatchObject({ available: false, affordable: false });
    g.state.prestige['core-power'] = 3;
    expect(prestigeNodeViews(g.state, g.content).find((v) => v.id === 'core-power')).toMatchObject({ maxed: true, affordable: false, cost: 4 });
  });
});
