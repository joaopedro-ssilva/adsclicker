import { describe, expect, it } from 'vitest';
import { content } from '../../content';
import type { Emit, GameEvent } from '../../store/types';
import { click, graduate } from '../actions';
import { Decimal } from '../decimal';
import { createInitialState } from '../init';
import { createRng } from '../rng';
import { deserializeState, serializeState } from '../save';
import { advance } from '../tick';
import { diplomaCap } from '../prestige';
import { buyMaestriaLevel, fireRollforward, freeSlots, hitSwarmBug, startSwarm, unlockMaestria, updateSwarm } from './index';

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
  it('one slot per graduation, level 1 is free, the rest cost diplomas', () => {
    const g = game();
    expect(freeSlots(g.state)).toBe(0);
    expect(unlockMaestria(g.state, content, 'edecio', g.emit)).toBe(false);
    g.state.counters.graduations = 2;
    expect(freeSlots(g.state)).toBe(2);
    expect(unlockMaestria(g.state, content, 'edecio', g.emit)).toBe(true);
    expect(unlockMaestria(g.state, content, 'edecio', g.emit)).toBe(false);
    expect(unlockMaestria(g.state, content, 'b2', g.emit)).toBe(false); // not built yet
    expect(freeSlots(g.state)).toBe(1);

    expect(buyMaestriaLevel(g.state, content, 'edecio', g.emit)).toBe(false);
    g.state.diplomas = 50;
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
    const loaded = deserializeState(JSON.stringify(raw), content, T0);
    expect(loaded?.maestria.levels).toEqual({ edecio: 5 });
  });
});

describe('Joinha de Ouro', () => {
  it('the click after enough clicks is golden: seconds of production, once', () => {
    const g = game();
    g.state.maestria.levels = { edecio: 1 };
    const needed = content.maestrias.joinha.clicksNeeded[0] ?? 100;
    let t = T0;
    for (let i = 0; i < needed; i += 1) {
      t += 100;
      click(g.state, content, t, g.rng, g.emit);
    }
    g.events.length = 0;
    t += 100;
    click(g.state, content, t, g.rng, g.emit);
    const golden = g.events.find((e) => e.type === 'click');
    expect(golden).toMatchObject({ golden: true });
    expect(g.state.maestria.joinha.clicks).toBe(0);
    t += 100;
    g.events.length = 0;
    click(g.state, content, t, g.rng, g.emit);
    expect(g.events.find((e) => e.type === 'click')).toMatchObject({ golden: false });
  });
});

describe('click limit', () => {
  it('drops clicks past the ceiling without a trace', () => {
    const g = game();
    g.state.maestria.levels = { edecio: 1, gladimir: 1 };
    const limit = content.balance.clickLimit?.perSecond ?? 15;
    for (let i = 0; i < limit * 4; i += 1) click(g.state, content, T0 + i, g.rng, g.emit);
    expect(g.state.counters.clicks).toBe(limit);
    expect(g.state.maestria.joinha.clicks).toBe(limit);
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
    expect(diplomaCap(g.state, content)).toBe(13);
    graduate(g.state, content, T0, g.emit);
    expect(g.state.diplomas).toBe(23);
  });
});
