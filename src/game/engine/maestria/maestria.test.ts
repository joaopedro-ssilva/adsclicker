import { describe, expect, it } from 'vitest';
import { PROFESSOR_IDS } from '../../content/types';
import { content } from '../../content';
import type { Emit, GameEvent } from '../../store/types';
import { click, graduate } from '../actions';
import { Decimal } from '../decimal';
import { createInitialState } from '../init';
import { createRng } from '../rng';
import { deserializeState, serializeState } from '../save';
import { advance } from '../tick';
import { angeloCapFactor, diplomaCap, maxAngeloCapFactor } from '../prestige';
import { computeStats } from '../stats';
import { joinhaView } from '../views';
import { buyMaestriaLevel, fireRollforward, freeSlots, goldenActive, hitSwarmBug, resetMaestriasForGraduation, startSwarm, unlockMaestria, updateSwarm } from './index';

const T0 = 1_700_000_000_000;

function game() {
  const events: GameEvent[] = [];
  const emit: Emit = (event) => events.push(event);
  const state = createInitialState(content, T0);
  for (const id of ['edecio', 'gladimir', 'wagner'] as const) state.hired[id] = true;
  state.levels[content.disciplines[0]?.id ?? ''] = 50;
  return { state, events, emit, rng: createRng(7) };
}

describe('slots and levels', () => {
  it('stops handing out slots once every professor has one', () => {
    const g = game();
    g.state.counters.graduations = 30;
    expect(freeSlots(g.state)).toBe(PROFESSOR_IDS.length);
    for (const id of PROFESSOR_IDS) g.state.maestria.levels[id] = 1;
    expect(freeSlots(g.state)).toBe(0);
  });

  it('one slot per graduation, level 1 is free, the rest cost diplomas', () => {
    const g = game();
    expect(freeSlots(g.state)).toBe(0);
    expect(unlockMaestria(g.state, content, 'edecio', g.emit)).toBe(false);
    g.state.counters.graduations = 2;
    expect(freeSlots(g.state)).toBe(2);
    expect(unlockMaestria(g.state, content, 'edecio', g.emit)).toBe(true);
    expect(unlockMaestria(g.state, content, 'edecio', g.emit)).toBe(false);
    const unbuilt = structuredClone(content);
    unbuilt.maestrias.defs.b2.built = false;
    expect(unlockMaestria(g.state, unbuilt, 'b2', g.emit)).toBe(false); // not built
    expect(freeSlots(g.state)).toBe(1);

    expect(buyMaestriaLevel(g.state, content, 'edecio', g.emit)).toBe(false);
    g.state.diplomas = content.maestrias.defs.edecio.levelCosts[0] ?? 0;
    expect(buyMaestriaLevel(g.state, content, 'edecio', g.emit)).toBe(true);
    expect(g.state.maestria.levels.edecio).toBe(2);
    expect(g.state.diplomas).toBe(0);
  });

  it('survives a save round trip, and an old save without the field loads', () => {
    const g = game();
    g.state.maestria.levels = { edecio: 3, gladimir: 2 };
    g.state.maestria.rollforward = { clicks: 12, charges: 1 };
    const back = deserializeState(serializeState(g.state), content, T0);
    expect(back?.maestria.levels).toEqual({ edecio: 3, gladimir: 2 });
    expect(back?.maestria.rollforward).toEqual({ clicks: 12, charges: 1 });

    const raw = JSON.parse(serializeState(g.state)) as Record<string, unknown>;
    delete raw.maestria;
    const old = deserializeState(JSON.stringify(raw), content, T0);
    expect(old?.maestria.levels).toEqual({});
  });

  it('a save cannot hold levels above 5 or of a Maestria that is not built', () => {
    const raw = JSON.parse(serializeState(createInitialState(content, T0))) as Record<string, unknown>;
    raw.maestria = { levels: { edecio: 99, b2: 3, nobody: 2 } };
    const unbuilt = structuredClone(content);
    unbuilt.maestrias.defs.b2.built = false;
    const loaded = deserializeState(JSON.stringify(raw), unbuilt, T0);
    expect(loaded?.maestria.levels).toEqual({ edecio: 5 });
  });
});

describe('Joinha de Ouro', () => {
  const cfg = content.maestrias.joinha;
  const never = () => 0.99; // no crit

  /** A game with Edécio's Maestria at `level`, clicking every 100 ms until the combo is full. */
  function nearFull(level = 1) {
    const g = game();
    g.state.maestria.levels = { edecio: level };
    const max = computeStats(g.state, content).comboMax;
    let t = T0;
    for (let i = 0; i <= max; i += 1) {
      t += 100; // the first click only opens the combo, each one after it adds a step
      click(g.state, content, t, never, g.emit);
    }
    return { g, t, max };
  }
  const lastClick = (g: ReturnType<typeof game>) => g.events.filter((e) => e.type === 'click').at(-1);

  it('a full combo starts the golden mode: the clicks are worth the multiplier and the recharge counts from its end', () => {
    const { g, t, max } = nearFull();
    expect(g.state.combo.steps).toBe(max);
    const seconds = (cfg.seconds[0] ?? 0) * 1000;
    const mult = cfg.multiplier[0] ?? 1;
    expect(g.state.maestria.joinha.activeUntil).toBeGreaterThan(0);
    expect(goldenActive(g.state, t)).toBe(true);
    const startedAt = g.state.maestria.joinha.activeUntil - seconds;
    expect(g.state.maestria.joinha.readyAt).toBe(g.state.maestria.joinha.activeUntil + (cfg.rechargeSeconds[0] ?? 0) * 1000);
    expect(g.events.some((e) => e.type === 'joinhaStart')).toBe(true);

    // The next click pays the multiplier times what the same click pays on the same save without the Maestria.
    const twin = deserializeState(serializeState(g.state), content, t);
    if (!twin) throw new Error('twin did not load');
    twin.maestria.levels = {};
    const before = g.state.coins;
    click(g.state, content, t + 100, never, g.emit);
    const paid = g.state.coins.sub(before);
    expect(lastClick(g)).toMatchObject({ golden: true });
    const twinBefore = twin.coins;
    click(twin, content, t + 100, never, () => {});
    expect(paid.div(twin.coins.sub(twinBefore)).toNumber()).toBeCloseTo(mult, 5);
    expect(startedAt).toBeLessThanOrEqual(t);
  });

  it('the combo does not fall while the mode lasts, then falls from its end', () => {
    const { g, t, max } = nearFull();
    const { activeUntil } = g.state.maestria.joinha;
    advance(g.state, content, activeUntil - 500, g.rng, g.emit);
    expect(g.state.combo.steps).toBe(max);
    advance(g.state, content, activeUntil + 1500, g.rng, g.emit);
    expect(g.state.combo.steps).toBeLessThan(max);
    expect(t).toBeLessThan(activeUntil);
  });

  it('it does not start again before the recharge is over, and a full combo starts it after', () => {
    const { g, max } = nearFull();
    const { activeUntil, readyAt } = g.state.maestria.joinha;
    // Clicks after the mode ended, inside the recharge: golden is off and the mode keeps its times.
    let t = activeUntil + 100;
    g.state.combo.steps = max;
    g.state.combo.lastClickAt = t - 50;
    g.state.lastTickAt = t - 50;
    click(g.state, content, t, never, g.emit);
    expect(lastClick(g)).toMatchObject({ golden: false });
    expect(g.state.maestria.joinha).toEqual({ activeUntil, readyAt });
    // Once the recharge is over a full combo starts a new one.
    t = readyAt + 100;
    g.state.combo.steps = max;
    g.state.combo.lastClickAt = t - 50;
    g.state.lastTickAt = t - 50;
    click(g.state, content, t, never, g.emit);
    expect(lastClick(g)).toMatchObject({ golden: true });
    expect(g.state.maestria.joinha.activeUntil).toBeGreaterThan(readyAt);
  });

  it("with Edécio's honour the combo limit doubles, so the trigger waits for the new maximum", () => {
    const g = game();
    g.state.maestria.levels = { edecio: 1 };
    g.state.honoured = 'edecio';
    const stats = computeStats(g.state, content);
    expect(stats.comboMax).toBeGreaterThan(content.balance.combo.baseMax);
    let t = T0;
    for (let i = 0; i < content.balance.combo.baseMax + 3; i += 1) {
      t += 100;
      click(g.state, content, t, never, g.emit);
    }
    expect(goldenActive(g.state, t)).toBe(false);
    for (let i = 0; i < stats.comboMax; i += 1) {
      t += 100;
      click(g.state, content, t, never, g.emit);
    }
    expect(goldenActive(g.state, t)).toBe(true);
  });

  it('a Rollforward advances the recharge but never the running mode', () => {
    const { g } = nearFull();
    g.state.maestria.levels.gladimir = 1;
    g.state.maestria.rollforward = { clicks: 0, charges: 1 };
    const before = { ...g.state.maestria.joinha };
    // Pretend the mode already ended and the recharge has a long way to go.
    g.state.maestria.joinha = { activeUntil: before.activeUntil, readyAt: before.activeUntil + 500_000 };
    const jump = (content.maestrias.rollforward.jumpSeconds[0] ?? 0) * 1000;
    expect(fireRollforward(g.state, content, g.emit)).toBe(true);
    expect(g.state.maestria.joinha.activeUntil).toBe(before.activeUntil);
    expect(g.state.maestria.joinha.readyAt).toBe(before.activeUntil + 500_000 - jump);
    // A jump bigger than the recharge stops at the end of the mode.
    g.state.maestria.joinha.readyAt = before.activeUntil + 1000;
    g.state.maestria.rollforward.charges = 1;
    fireRollforward(g.state, content, g.emit);
    expect(g.state.maestria.joinha).toEqual({ activeUntil: before.activeUntil, readyAt: before.activeUntil });
  });

  it('graduating ends an active mode and clears the recharge', () => {
    const { g } = nearFull();
    resetMaestriasForGraduation(g.state);
    expect(g.state.maestria.joinha).toEqual({ activeUntil: 0, readyAt: 0 });
  });

  it('a save in the old shape loads with the new fields at their defaults, the new shape round-trips', () => {
    const g = game();
    g.state.maestria.levels = { edecio: 2 };
    const raw = JSON.parse(serializeState(g.state)) as { maestria: { joinha: unknown } };
    raw.maestria.joinha = { clicks: 321 };
    const old = deserializeState(JSON.stringify(raw), content, T0);
    expect(old?.maestria.joinha).toEqual({ activeUntil: 0, readyAt: 0 });
    raw.maestria.joinha = { activeUntil: T0 + 5000, readyAt: 'x' };
    expect(deserializeState(JSON.stringify(raw), content, T0)?.maestria.joinha).toEqual({ activeUntil: T0 + 5000, readyAt: 0 });
    g.state.maestria.joinha = { activeUntil: T0 + 5000, readyAt: T0 + 9000 };
    expect(deserializeState(serializeState(g.state), content, T0)?.maestria.joinha).toEqual({ activeUntil: T0 + 5000, readyAt: T0 + 9000 });
  });

  it('the levels only get better, and level 5 adds 30% to 40% of click income over a full cycle', () => {
    const gain = (i: number) => (((cfg.multiplier[i] ?? 1) - 1) * (cfg.seconds[i] ?? 0)) / ((cfg.seconds[i] ?? 0) + (cfg.rechargeSeconds[i] ?? 0));
    for (let i = 1; i < 5; i += 1) {
      expect(cfg.seconds[i]).toBeGreaterThan(cfg.seconds[i - 1] ?? 0);
      expect(cfg.multiplier[i]).toBeGreaterThan(cfg.multiplier[i - 1] ?? 0);
      expect(cfg.rechargeSeconds[i]).toBeLessThan(cfg.rechargeSeconds[i - 1] ?? 0);
    }
    expect(gain(4)).toBeGreaterThanOrEqual(0.3);
    expect(gain(4)).toBeLessThanOrEqual(0.4);
  });

  it('the view shows each state: ready, active, recharging', () => {
    const g = game();
    g.state.maestria.levels = { edecio: 1 };
    expect(joinhaView(g.state, content, T0)).toMatchObject({ ready: true, active: null, recharge: null });
    g.state.maestria.joinha = { activeUntil: T0 + 8000, readyAt: T0 + 158_000 };
    expect(joinhaView(g.state, content, T0 + 2000)).toMatchObject({ ready: false, active: { leftMs: 6000 }, recharge: null });
    expect(joinhaView(g.state, content, T0 + 10_000)).toMatchObject({ ready: false, active: null, recharge: { leftMs: 148_000 } });
    expect(joinhaView(g.state, content, T0 + 200_000)).toMatchObject({ ready: true, active: null, recharge: null });
  });
});

describe('click limit', () => {
  it('drops clicks past the ceiling without a trace', () => {
    const g = game();
    g.state.maestria.levels = { edecio: 1, gladimir: 1 };
    const limit = content.balance.clickLimit?.perSecond ?? 15;
    for (let i = 0; i < limit * 4; i += 1) click(g.state, content, T0 + i, g.rng, g.emit);
    expect(g.state.counters.clicks).toBe(limit);
    expect(g.state.maestria.rollforward.clicks).toBe(limit);
    expect(g.events.filter((e) => e.type === 'click')).toHaveLength(limit);
    click(g.state, content, T0 + 1500, g.rng, g.emit); // the window moved on
    expect(g.state.counters.clicks).toBe(limit + 1);
  });

  it('lets the hold-to-click pace (10 a second) through', () => {
    const g = game();
    for (let i = 0; i < 100; i += 1) click(g.state, content, T0 + i * 100, g.rng, g.emit);
    expect(g.state.counters.clicks).toBe(100);
  });
});

describe('Rollforward', () => {
  it('charges with clicks, pays the period and moves the recharge timers, not the running ones', () => {
    const g = game();
    g.state.maestria.levels = { gladimir: 1 };
    const fill = content.maestrias.rollforward.clicksToFill;
    expect(fireRollforward(g.state, content, g.emit)).toBe(false);
    for (let i = 0; i < fill; i += 1) click(g.state, content, T0 + i * 100, g.rng, g.emit);
    expect(g.state.maestria.rollforward.charges).toBe(1);

    const now = T0 + fill * 100;
    const jump = (content.maestrias.rollforward.jumpSeconds[0] ?? 0) * 1000;
    g.state.abilityReadyAt = { x: now + 100_000 };
    g.state.sprint.nextOffersAt = now + 100_000;
    g.state.nextInvasionAt = now + 100_000;
    g.state.buffs = [{ id: 'b', name: 'b', emoji: '', effects: [], startedAt: now, endsAt: now + 50_000, source: 'ability' }];
    g.state.sprint.active = { def: 'none', startedAt: now, endsAt: now + 90_000, progress: 0, target: 10 };
    const before = g.state.coins;
    expect(fireRollforward(g.state, content, g.emit)).toBe(true);

    expect(g.state.coins.gt(before)).toBe(true);
    expect(g.state.abilityReadyAt.x).toBe(now + 100_000 - jump);
    expect(g.state.sprint.nextOffersAt).toBe(now + 100_000 - jump);
    expect(g.state.nextInvasionAt).toBe(now + 100_000 - jump);
    expect(g.state.buffs[0]?.endsAt).toBe(now + 50_000);
    expect(g.state.sprint.active?.endsAt).toBe(now + 90_000);
    expect(g.state.maestria.rollforward.charges).toBe(0);
  });
});

describe('Super invasão', () => {
  function charged() {
    const g = game();
    g.state.maestria.levels = { wagner: 1 };
    advance(g.state, content, T0 + 1000, g.rng, g.emit);
    const hour = (content.maestrias.swarm.chargeMinutes[0] ?? 60) * 60_000;
    return { g, now: T0 + 1000 + hour };
  }

  it('needs its charge, then starts and pays what was defeated, with a bonus for clearing all', () => {
    const { g, now } = charged();
    expect(startSwarm(g.state, content, now - 60_000, g.emit)).toBe(false);
    expect(startSwarm(g.state, content, now, g.emit)).toBe(true);
    expect(startSwarm(g.state, content, now, g.emit)).toBe(false);

    let t = now;
    const cfg = content.maestrias.swarm;
    const coinsBefore = g.state.coins;
    while (g.state.maestria.swarm.active && t < now + cfg.durationMs + 1000) {
      t += 250;
      updateSwarm(g.state, content, t, g.rng, g.emit);
      for (const bug of [...(g.state.maestria.swarm.active?.bugs ?? [])]) {
        for (let i = 0; i < bug.hp; i += 1) hitSwarmBug(g.state, content, bug.uid, t, g.emit);
      }
    }
    const end = g.events.find((e) => e.type === 'swarmEnd');
    expect(end).toMatchObject({ defeated: cfg.bugs, bossDefeated: true, cleared: true });
    expect(g.state.coins.gt(coinsBefore)).toBe(true);
    expect(g.state.maestria.swarm.active).toBeNull();
    expect(g.state.maestria.swarm.since).toBe(now); // the next charge started at the first click
  });

  it('a swarm nobody defends ends at its time with nothing paid, and the firewall defends by itself', () => {
    const { g, now } = charged();
    startSwarm(g.state, content, now, g.emit);
    advance(g.state, content, now + 1000, g.rng, g.emit);
    updateSwarm(g.state, content, now + content.maestrias.swarm.durationMs + 1, g.rng, g.emit);
    expect(g.events.find((e) => e.type === 'swarmEnd')).toMatchObject({ defeated: 0, bossDefeated: false, cleared: false });

    const second = charged();
    second.g.state.maestria.levels = { wagner: 5 };
    advance(second.g.state, content, second.now, second.g.rng, second.g.emit);
    startSwarm(second.g.state, content, second.now, second.g.emit);
    for (let t = second.now; t <= second.now + content.maestrias.swarm.durationMs + 500; t += 250) {
      updateSwarm(second.g.state, content, t, second.g.rng, second.g.emit);
    }
    const end = second.g.events.find((e) => e.type === 'swarmEnd');
    expect(end && end.type === 'swarmEnd' ? end.defeated : 0).toBeGreaterThan(5);
  });

  it('a graduation drops a swarm in progress but keeps the charge', () => {
    const { g, now } = charged();
    startSwarm(g.state, content, now, g.emit);
    g.state.hired.angelo = true;
    g.state.runCoins = new Decimal('2e21');
    expect(graduate(g.state, content, now, g.emit)).toBe(true);
    expect(g.state.maestria.swarm.active).toBeNull();
    expect(g.state.maestria.swarm.since).toBe(now);
  });
});

describe('diploma cap', () => {
  it('holds a graduation to base x growth ^ graduations', () => {
    const g = game();
    g.state.hired.angelo = true;
    g.state.runCoins = new Decimal('2e30'); // sqrt(1e11) is far past any cap
    expect(diplomaCap(g.state, content)).toBe(10);
    expect(graduate(g.state, content, T0, g.emit)).toBe(true);
    expect(g.state.diplomas).toBe(10);
    g.state.hired.angelo = true;
    g.state.runCoins = new Decimal('2e30');
    expect(diplomaCap(g.state, content)).toBe(11);
    graduate(g.state, content, T0, g.emit);
    expect(g.state.diplomas).toBe(21);
  });

  it("stretches by the same proportion as Angelo's Domínio and his honour add to the diplomas", () => {
    const g = game();
    g.state.hired.angelo = true;
    expect(angeloCapFactor(g.state, content)).toBe(1);
    // 20 ranks of Domínio: +0.5% each in diplomas, so the cap is 10% bigger
    const angelo = content.disciplines.find((d) => d.professor === 'angelo');
    g.state.levels[angelo?.id ?? ''] = 25 * 20;
    const perRank = content.mastery.angelo.perRank[0]?.value ?? 0;
    expect(angeloCapFactor(g.state, content)).toBeCloseTo(1 + perRank * 20, 9);
    expect(diplomaCap(g.state, content)).toBe(Math.floor(10 * (1 + perRank * 20) + 1e-9));
    // honoured: x1.25 on top
    g.state.honoured = 'angelo';
    const honour = content.mastery.angelo.honour.flat?.[0]?.value ?? 1;
    expect(diplomaCap(g.state, content)).toBe(Math.floor(10 * (1 + perRank * 20) * honour + 1e-9));
    // the cap grows with the graduations as before
    g.state.counters.graduations = 1;
    expect(diplomaCap(g.state, content)).toBe(Math.floor(10 * 1.18 * (1 + perRank * 20) * honour + 1e-9));
  });

  it('lets Angelo pay the stretched cap at graduation, and nobody else stretches it', () => {
    const g = game();
    g.state.hired.angelo = true;
    g.state.honoured = 'angelo';
    g.state.runCoins = new Decimal('2e30');
    const cap = diplomaCap(g.state, content) ?? 0;
    expect(cap).toBeGreaterThan(10); // the honour alone gives x1.25
    expect(graduate(g.state, content, T0, g.emit)).toBe(true);
    expect(g.state.diplomas).toBe(cap);
    const other = game();
    other.state.hired.angelo = true;
    other.state.honoured = 'pablo';
    expect(diplomaCap(other.state, content)).toBe(10);
  });

  it('has a server ceiling of Domínio maxed, with the honour only once Angelo has been honoured', () => {
    const perRank = content.mastery.angelo.perRank[0]?.value ?? 0;
    expect(maxAngeloCapFactor(content, false)).toBeCloseTo(1 + perRank * content.balance.mastery.cap, 9);
    expect(maxAngeloCapFactor(content, true)).toBeGreaterThan(maxAngeloCapFactor(content, false));
  });
});
