import { describe, expect, it } from 'vitest';
import { content } from '../../content';
import { PROFESSOR_IDS } from '../../content/types';
import type { Emit, GameEvent } from '../../store/types';
import { activateAbility, buyDiscipline, click, graduate } from '../actions';
import { getIndex } from '../contentIndex';
import { Decimal } from '../decimal';
import { levelOf } from '../economy';
import { levelCost } from '../formulas';
import { createInitialState } from '../init';
import { diplomaCap } from '../prestige';
import { createRng } from '../rng';
import { deserializeState, serializeState } from '../save';
import { computeStats } from '../stats';
import { advance } from '../tick';
import { measureCondition, createProbe } from '../achievements';
import {
  bolsaMaxSeconds,
  buyAsset,
  depositFund,
  horasBandsFilled,
  liquidateBolsa,
  nextPrice,
  releaseMultiplier,
  releaseVersions,
  sellAsset,
  startFesta,
  updateBolsa,
  withdrawFund,
} from './index';
import { atLevel } from './levelTable';
import { shiftMaestriaTimers } from './timers';

const T0 = 1_700_000_000_000;

function game(levels: Partial<Record<(typeof PROFESSOR_IDS)[number], number>> = {}) {
  const events: GameEvent[] = [];
  const emit: Emit = (event) => events.push(event);
  const state = createInitialState(content, T0);
  for (const id of PROFESSOR_IDS) state.hired[id] = true;
  state.counters.graduations = 8;
  state.maestria.levels = { ...levels };
  state.coins = new Decimal('1e60');
  return { state, events, emit, rng: createRng(11) };
}

describe('Design System (B2)', () => {
  it('free levels only flow down to classes that cost less than the level just paid', () => {
    const g = game({ b2: 5 });
    const index = getIndex(content);
    const expensive = content.disciplines.filter((def) => def.professor === 'pablo')[0];
    if (!expensive) throw new Error('no discipline');
    // Every class open, at a level that makes some cheap and some dear.
    for (const def of content.disciplines) g.state.levels[def.id] = def.id === expensive.id ? 5 : 3;
    const stats = computeStats(g.state, content);
    const before = { ...g.state.levels };
    const paid = levelCost(index.baseCost.get(expensive.id)!, 5, stats);
    expect(buyDiscipline(g.state, content, expensive.id, T0, g.emit, () => 0)).toBe(true);
    const gifts = g.events.find((e) => e.type === 'designSystem');
    expect(gifts).toBeDefined();
    if (gifts?.type !== 'designSystem') return;
    for (const gift of gifts.gifts) {
      const cost = levelCost(index.baseCost.get(gift.id)!, before[gift.id] ?? 0, stats);
      expect(cost.lt(paid)).toBe(true);
      expect(levelOf(g.state, gift.id)).toBe((before[gift.id] ?? 0) + gift.levels);
    }
    // Never up: the cheapest class bought with a roll that always hits gives nothing dearer than itself.
    const cheapest = content.disciplines[0]!;
    const g2 = game({ b2: 5 });
    for (const def of content.disciplines) g2.state.levels[def.id] = def.id === cheapest.id ? 0 : 10;
    buyDiscipline(g2.state, content, cheapest.id, T0, g2.emit, () => 0);
    expect(g2.events.some((e) => e.type === 'designSystem')).toBe(false);
  });

  it('free levels are invisible to the counters, the run and the achievements of hand play', () => {
    const g = game({ b2: 5 });
    const expensive = content.disciplines.filter((def) => def.professor === 'pablo')[0]!;
    for (const def of content.disciplines) g.state.levels[def.id] = def.id === expensive.id ? 5 : 3;
    buyDiscipline(g.state, content, expensive.id, T0, g.emit, () => 0);
    expect(g.state.counters.levelsBought).toBe(1);
    expect(g.state.run.levelsBought).toBe(1);
  });

  it('does nothing without the Maestria or without an rng', () => {
    const none = game();
    const dear = content.disciplines.filter((def) => def.professor === 'pablo')[0]!;
    for (const def of content.disciplines) none.state.levels[def.id] = def.id === dear.id ? 5 : 3;
    const before = { ...none.state.levels };
    buyDiscipline(none.state, content, dear.id, T0, none.emit, () => 0);
    expect(Object.keys(none.state.levels).filter((id) => id !== dear.id && none.state.levels[id] !== before[id])).toEqual([]);
    const quiet = game({ b2: 5 });
    for (const def of content.disciplines) quiet.state.levels[def.id] = def.id === dear.id ? 5 : 3;
    buyDiscipline(quiet.state, content, dear.id, T0, quiet.emit);
    expect(quiet.events.some((e) => e.type === 'designSystem')).toBe(false);
  });
});

describe('Festa de lançamento (Guto)', () => {
  function charged(level = 5) {
    const g = game({ guto: level });
    g.state.research['edecio-aula-show'] = true;
    advance(g.state, content, T0 + 1000, g.rng, g.emit);
    const now = T0 + 1000 + atLevel(content.maestrias.festa.rechargeMinutes, level) * 60_000;
    return { g, now };
  }

  it('needs its recharge, then fires every ability at once without counting them as used by hand', () => {
    const { g, now } = charged();
    expect(startFesta(g.state, content, now - 60_000, g.emit)).toBe(false);
    g.state.abilityReadyAt['auto-scaling'] = now + 500_000; // still recharging
    expect(startFesta(g.state, content, now, g.emit)).toBe(true);
    expect(startFesta(g.state, content, now, g.emit)).toBe(false);

    const ids = g.state.buffs.map((buff) => buff.id);
    expect(ids).toContain('buff-festa-5');
    expect(ids).toContain('buff-auto-scaling');
    expect(g.state.buffs.every((buff) => buff.source === 'maestria')).toBe(true);
    expect(g.state.counters.abilitiesUsed).toBe(0);
    expect(g.state.abilitiesTried).toEqual({});
    // The party's stats are in force: abilities recharge faster and everything is boosted.
    const stats = computeStats(g.state, content);
    expect(stats.abilityCooldown).toBeCloseTo(content.maestrias.festa.cooldown[4] ?? 1);
    expect(stats.globalPower).toBeGreaterThan(content.maestrias.festa.power[4] ?? 1);
    // It does not satisfy "every ability running by hand".
    const achievement = content.achievements.find((a) => a.condition.kind === 'abilitiesActive');
    expect(achievement && measureCondition(g.state, content, achievement.condition, createProbe(g.state, content)).met).toBe(false);
    expect(g.events.some((e) => e.type === 'festaStart')).toBe(true);
  });

  it('lasts its time, then the buff ends', () => {
    const { g, now } = charged(1);
    startFesta(g.state, content, now, g.emit);
    g.state.lastTickAt = now;
    advance(g.state, content, now + (content.maestrias.festa.seconds[0] ?? 40) * 1000 + 1000, g.rng, g.emit);
    expect(g.state.buffs.some((buff) => buff.id.startsWith('buff-festa-'))).toBe(false);
  });

  it('the Rollforward moves its recharge, and a graduation keeps it but ends the party', () => {
    const { g, now } = charged();
    startFesta(g.state, content, now, g.emit);
    shiftMaestriaTimers(g.state, 60_000);
    expect(g.state.maestria.festa.since).toBe(now - 60_000);
    g.state.hired.angelo = true;
    g.state.runCoins = new Decimal('2e21');
    expect(graduate(g.state, content, now, g.emit)).toBe(true);
    expect(g.state.buffs).toEqual([]);
    expect(g.state.maestria.festa.since).toBe(now - 60_000);
  });

  it('abilities used by hand still count', () => {
    const g = game();
    g.state.maestria.levels = {};
    expect(activateAbility(g.state, content, 'auto-scaling', T0, g.emit)).toBe(true);
    expect(g.state.counters.abilitiesUsed).toBe(1);
  });
});

describe('Releases (B1)', () => {
  it('a version per N sprints of the run, up to the limit, and the multiplier is bounded', () => {
    const g = game({ b1: 1 });
    expect(releaseVersions(g.state, content)).toBe(0);
    g.state.run.sprintsCompleted = 12;
    expect(releaseVersions(g.state, content)).toBe(2);
    expect(releaseMultiplier(g.state, content)).toBeCloseTo(1.06);
    g.state.run.sprintsCompleted = 10_000;
    expect(releaseVersions(g.state, content)).toBe(content.maestrias.releases.maxVersions);
    g.state.maestria.levels = { b1: 5 };
    expect(releaseVersions(g.state, content)).toBe(content.maestrias.releases.maxVersions);
    expect(releaseMultiplier(g.state, content)).toBeCloseTo(1 + 10 * 0.05);
    expect(computeStats(g.state, content).globalPower).toBeGreaterThan(1.49);
  });

  it('starts again with the next run', () => {
    const g = game({ b1: 5 });
    g.state.run.sprintsCompleted = 9;
    g.state.hired.angelo = true;
    g.state.runCoins = new Decimal('2e21');
    graduate(g.state, content, T0, g.emit);
    expect(releaseVersions(g.state, content)).toBe(0);
  });
});

describe('Horas complementares (Angelo)', () => {
  it('counts what the player does, no single activity fills the bar, and bands pay diplomas outside the cap', () => {
    const g = game({ angelo: 2 });
    g.state.hired.angelo = true;
    // Only clicks: capped at the share of the bar, so it never fills it alone.
    g.state.maestria.horas.clicks = 1e9;
    expect(horasBandsFilled(g.state, content)).toBeLessThan(atLevel(content.maestrias.horas.bands, 2));
    g.state.maestria.horas = { clicks: 1e9, invasions: 1e9, sprints: 1e9, abilities: 1e9, levels: 1e9 };
    const bands = atLevel(content.maestrias.horas.bands, 2);
    expect(horasBandsFilled(g.state, content)).toBe(bands);

    g.state.runCoins = new Decimal('2e60'); // far past the cap
    const cap = diplomaCap(g.state, content) ?? 0;
    graduate(g.state, content, T0, g.emit);
    expect(g.state.diplomas).toBe(cap + bands);
    expect(g.state.diplomasEarned).toBe(cap + bands);
    expect(g.events.find((e) => e.type === 'graduate')).toMatchObject({ diplomas: cap + bands, bonus: bands });
    expect(g.state.maestria.horas).toEqual({ clicks: 0, invasions: 0, sprints: 0, abilities: 0, levels: 0 });
  });

  it('is fed by clicks and purchases, and only once the Maestria exists', () => {
    const off = game();
    click(off.state, content, T0, off.rng, off.emit);
    expect(off.state.maestria.horas.clicks).toBe(0);
    const on = game({ angelo: 1 });
    click(on.state, content, T0, on.rng, on.emit);
    expect(on.state.maestria.horas.clicks).toBeCloseTo(content.maestrias.horas.weights.click);
    buyDiscipline(on.state, content, content.disciplines[0]!.id, T0, on.emit);
    expect(on.state.maestria.horas.levels).toBeGreaterThan(0);
  });
});

describe('Bolsa de tokens (Pablo)', () => {
  function market(level = 5) {
    const g = game({ pablo: level });
    g.state.levels[content.disciplines[0]!.id] = 100;
    g.state.coins = new Decimal('1e12');
    updateBolsa(g.state, content, T0, g.rng); // opens the market
    return g;
  }
  const steps = (g: ReturnType<typeof market>, n: number) =>
    updateBolsa(g.state, content, g.state.maestria.bolsa.at + n * content.maestrias.bolsa.stepMs, g.rng);

  it('is deterministic for a seed and keeps every price inside its band', () => {
    const a = market();
    const b = market();
    steps(a, 300);
    steps(b, 300);
    expect(a.state.maestria.bolsa.assets).toEqual(b.state.maestria.bolsa.assets);
    for (const def of content.maestrias.bolsa.assets) {
      for (const p of a.state.maestria.bolsa.assets[def.id]?.history ?? []) {
        expect(p).toBeGreaterThanOrEqual(def.lo - 1e-9);
        expect(p).toBeLessThanOrEqual(def.hi + 1e-9);
      }
    }
    expect(a.state.maestria.bolsa.assets.gpu?.history.length).toBeLessThanOrEqual(content.maestrias.bolsa.historyLength);
  });

  it('every temperament moves differently: the spiky ones jump, the calm one does not', () => {
    const jumpOf = (id: string) => {
      const def = content.maestrias.bolsa.assets.find((asset) => asset.id === id)!;
      let price = 1;
      let biggest = 0;
      const rng = createRng(3);
      for (let i = 1; i < 2000; i += 1) {
        const next = nextPrice(def, price, i, rng(), rng(), rng());
        biggest = Math.max(biggest, Math.abs(Math.log(next / price)));
        price = next;
      }
      return biggest;
    };
    expect(jumpOf('startup')).toBeGreaterThan(jumpOf('gpu') * 4);
  });

  it('buys and sells, holding to the limit, and a profit is paid from the liquidity bucket', () => {
    const g = market(1);
    const bolsa = g.state.maestria.bolsa;
    const before = g.state.coins;
    expect(buyAsset(g.state, content, 'gpu', 1, g.emit)).toBe(true);
    const spent = before.sub(g.state.coins);
    expect(spent.gt(0)).toBe(true);
    expect(buyAsset(g.state, content, 'gpu', 1, g.emit)).toBe(false); // the limit is used up
    expect(buyAsset(g.state, content, 'dados', 1, g.emit)).toBe(false); // not open at level 1

    // The price doubles: the profit is more than the bucket can pay, so the sale is capped and the principal returns.
    bolsa.assets.gpu!.price = 1.25;
    bolsa.assets.gpu!.held.units = bolsa.assets.gpu!.held.units.mul(100);
    const coins = g.state.coins;
    const runCoins = g.state.runCoins;
    expect(sellAsset(g.state, content, 'gpu', 1, g.emit)).toBe(true);
    const received = g.state.coins.sub(coins);
    expect(received.gte(spent)).toBe(true);
    expect(bolsa.liquidity).toBeCloseTo(0, 6);
    const profit = g.state.runCoins.sub(runCoins);
    const cps = g.state.coins.gt(0) ? received.sub(spent) : profit;
    expect(profit.toNumber()).toBeCloseTo(cps.toNumber(), -2);
    expect(g.events.find((e) => e.type === 'bolsa' && e.side === 'sell')).toMatchObject({ capped: true });
  });

  it('the Fundo only grows, slowly, and is bounded like the rest', () => {
    const g = market(1);
    expect(depositFund(g.state, content, 0.5, g.emit)).toBe(true);
    const index = g.state.maestria.bolsa.fundIndex;
    steps(g, 60); // ten minutes
    expect(g.state.maestria.bolsa.fundIndex).toBeGreaterThan(index);
    expect(g.state.maestria.bolsa.fundIndex).toBeLessThan(index * 1.05);
    expect(withdrawFund(g.state, content, 1, g.emit)).toBe(true);
    expect(g.state.maestria.bolsa.fund.units.eq(0)).toBe(true);
  });

  it('a long gap catches up a bounded number of steps', () => {
    const g = market();
    const step = g.state.maestria.bolsa.step;
    updateBolsa(g.state, content, g.state.maestria.bolsa.at + 100 * 24 * 3_600_000, g.rng);
    expect(g.state.maestria.bolsa.step - step).toBe(content.maestrias.bolsa.catchUpSteps);
  });

  it('a graduation sells everything at the price of the moment and the profit counts for the run', () => {
    const g = market();
    buyAsset(g.state, content, 'gpu', 0.5, g.emit);
    depositFund(g.state, content, 0.5, g.emit);
    liquidateBolsa(g.state, content);
    expect(g.state.maestria.bolsa.fund.cost.eq(0)).toBe(true);
    expect(g.state.maestria.bolsa.assets.gpu?.held.units.eq(0)).toBe(true);
    const h = market();
    buyAsset(h.state, content, 'gpu', 1, h.emit);
    h.state.hired.angelo = true;
    h.state.runCoins = new Decimal('2e21');
    graduate(h.state, content, T0, h.emit);
    expect(h.state.maestria.bolsa.assets.gpu?.held.cost.eq(0)).toBe(true);
    expect(h.state.maestria.bolsa.assets.gpu?.price).toBeGreaterThan(0); // the market keeps going
  });

  it('the server bound grows with the level and the window, and is zero without the Maestria', () => {
    expect(bolsaMaxSeconds(content, 0, 600)).toBe(0);
    expect(bolsaMaxSeconds(content, 5, 3600)).toBeCloseTo(2 * 15 * 60);
    expect(bolsaMaxSeconds(content, 1, 3600)).toBeLessThan(bolsaMaxSeconds(content, 5, 3600));
  });
});

describe('save', () => {
  it('round trips the second wave and an old save loads with defaults', () => {
    const g = game({ guto: 3, angelo: 2, pablo: 4 });
    updateBolsa(g.state, content, T0, g.rng);
    g.state.levels[content.disciplines[0]!.id] = 100;
    buyAsset(g.state, content, 'gpu', 0.5, g.emit);
    depositFund(g.state, content, 0.5, g.emit);
    g.state.maestria.festa.since = T0 - 5000;
    g.state.maestria.horas.sprints = 4.5;
    const back = deserializeState(serializeState(g.state), content, T0);
    expect(back?.maestria.festa.since).toBe(T0 - 5000);
    expect(back?.maestria.horas.sprints).toBe(4.5);
    expect(back?.maestria.bolsa.assets.gpu?.held.cost.toString()).toBe(g.state.maestria.bolsa.assets.gpu?.held.cost.toString());
    expect(back?.maestria.bolsa.fund.units.toString()).toBe(g.state.maestria.bolsa.fund.units.toString());
    expect(back?.maestria.bolsa.assets.gpu?.history).toEqual(g.state.maestria.bolsa.assets.gpu?.history);

    const raw = JSON.parse(serializeState(g.state)) as { maestria: Record<string, unknown> };
    delete raw.maestria.festa;
    delete raw.maestria.horas;
    delete raw.maestria.bolsa;
    const old = deserializeState(JSON.stringify(raw), content, T0);
    expect(old?.maestria.festa.since).toBe(0);
    expect(old?.maestria.horas.clicks).toBe(0);
    expect(old?.maestria.bolsa.fundIndex).toBe(1);
    expect(old?.maestria.levels.pablo).toBe(4);
  });

  it('a broken market in a save is repaired: prices clamped, nonsense holdings dropped', () => {
    const g = game({ pablo: 5 });
    updateBolsa(g.state, content, T0, g.rng);
    const raw = JSON.parse(serializeState(g.state)) as { maestria: { bolsa: { assets: Record<string, Record<string, unknown>>; liquidity: number; fundIndex: number } } };
    raw.maestria.bolsa.assets.gpu = { price: 99, history: ['x', 99, -1], held: { units: '5', cost: 'nope' } };
    raw.maestria.bolsa.liquidity = 1e12;
    raw.maestria.bolsa.fundIndex = -3;
    const loaded = deserializeState(JSON.stringify(raw), content, T0);
    const gpu = content.maestrias.bolsa.assets[0]!;
    expect(loaded?.maestria.bolsa.assets.gpu?.price).toBe(gpu.hi);
    expect(loaded?.maestria.bolsa.assets.gpu?.history.every((p) => p >= gpu.lo && p <= gpu.hi)).toBe(true);
    expect(loaded?.maestria.bolsa.assets.gpu?.held.units.eq(0)).toBe(true);
    expect((loaded?.maestria.bolsa.liquidity ?? 0)).toBeLessThanOrEqual(15 * 60);
    expect(loaded?.maestria.bolsa.fundIndex).toBe(1);
  });
});

describe('achievements of the Maestrias', () => {
  it('unlocking all eight, and one at the top level', () => {
    const g = game();
    const probe = () => createProbe(g.state, content);
    const all = content.achievements.find((a) => a.id === 'maestrias-all')!;
    const max = content.achievements.find((a) => a.id === 'maestrias-max')!;
    expect(measureCondition(g.state, content, all.condition, probe()).met).toBe(false);
    for (const id of PROFESSOR_IDS) g.state.maestria.levels[id] = 1;
    expect(measureCondition(g.state, content, all.condition, probe()).met).toBe(true);
    expect(measureCondition(g.state, content, max.condition, probe()).met).toBe(false);
    g.state.maestria.levels.pablo = 5;
    expect(measureCondition(g.state, content, max.condition, probe()).met).toBe(true);
  });
});
