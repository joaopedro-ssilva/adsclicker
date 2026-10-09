import { describe, expect, it } from 'vitest';
import { acceptSprint, buyMonitor, graduate, hitInvasion, setMonitorOn, setMonitorSettings } from './actions';
import { Decimal } from './decimal';
import { deserializeState, serializeState } from './save';
import { monitorsView } from './monitors';
import { advance } from './tick';
import type { GameState } from './state';
import { coins, eventsOf, hire, newCleanGame, num, T0 } from './__fixtures__/helpers';
import type { TestGame } from './__fixtures__/helpers';
import { content } from '../content';
import type { MonitorId } from '../content/types';

/** A game that already graduated once, so the monitors can be hired. */
function graduated(mutate?: Parameters<typeof newCleanGame>[0]): TestGame {
  const g = newCleanGame(mutate);
  g.state.counters.graduations = 1;
  g.state.diplomas = 5000;
  return g;
}

/** Hires a monitor straight into the state at `level`, bypassing the diploma cost. */
function employ(state: GameState, id: MonitorId, level = 1): void {
  state.monitors.units[id].level = level;
}

const step = (g: TestGame, ms: number) => advance(g.state, g.content, g.state.lastTickAt + ms, g.rng, g.emit);

function startInvasion(g: TestGame, def = 'phishing'): void {
  g.state.invasion = { uid: 1, def, spawnedAt: g.state.lastTickAt, expiresAt: g.state.lastTickAt + 10_000, clicksLeft: 3, x: 0.5, y: 0.5 };
  g.state.nextInvasionAt = T0 + 1e9;
}

describe('hiring', () => {
  it('needs the first graduation', () => {
    const g = newCleanGame();
    g.state.diplomas = 100;
    expect(buyMonitor(g.state, g.content, 'compras', T0, g.emit)).toBe(false);
    expect(g.state.diplomas).toBe(100);
  });

  it('pays the level cost, hires switched on, and raises one level at a time up to the last', () => {
    const g = graduated();
    g.state.diplomas = 5 + 25 + 100 + 400 + 1;
    expect(buyMonitor(g.state, g.content, 'compras', T0, g.emit)).toBe(true);
    expect(g.state.monitors.units.compras).toMatchObject({ level: 1, on: true });
    expect(g.state.diplomas).toBe(25 + 100 + 400 + 1);
    for (let i = 0; i < 3; i += 1) expect(buyMonitor(g.state, g.content, 'compras', T0, g.emit)).toBe(true);
    expect(g.state.monitors.units.compras.level).toBe(4);
    expect(g.state.diplomas).toBe(1);
    expect(buyMonitor(g.state, g.content, 'compras', T0, g.emit)).toBe(false);
    expect(eventsOf(g.events, 'purchase').filter((e) => e.kind === 'monitor')).toHaveLength(4);
  });

  it('refuses when the diplomas are short', () => {
    const g = graduated();
    g.state.diplomas = 4;
    expect(buyMonitor(g.state, g.content, 'compras', T0, g.emit)).toBe(false);
    expect(g.state.monitors.units.compras.level).toBe(0);
  });

  it('keeps the monitors through a graduation', () => {
    const g = graduated();
    hire(g.state, 'angelo');
    employ(g.state, 'compras', 3);
    employ(g.state, 'seguranca', 2);
    g.state.monitors.units.seguranca.on = false;
    g.state.runCoins = new Decimal('1e9');
    expect(graduate(g.state, g.content, T0, g.emit)).toBe(true);
    expect(g.state.monitors.units.compras.level).toBe(3);
    expect(g.state.monitors.units.seguranca).toMatchObject({ level: 2, on: false });
  });
});

describe('Compras', () => {
  it('buys the level with the best output per coin, not the cheapest', () => {
    const g = graduated();
    employ(g.state, 'compras');
    g.state.monitors.settings.comprasShare = 1;
    g.state.levels = { cafe: 12, 'muito-legal': 1 };
    coins(g.state, 1000);
    step(g, 1000);
    // cafe 12 -> 13 adds 2 for 54 coins; muito-legal 1 -> 2 adds 5 for 115: the dearer one pays better
    expect(g.state.levels['muito-legal']).toBe(2);
    expect(g.state.levels.cafe).toBe(12);
    expect(g.state.monitors.units.compras).toMatchObject({ done: 1, last: 'muito-legal' });
    expect(eventsOf(g.events, 'monitorAct')).toEqual([{ type: 'monitorAct', monitor: 'compras', id: 'muito-legal' }]);
  });

  it('only buys for professors the player already started by hand', () => {
    const g = graduated();
    hire(g.state, 'gladimir');
    employ(g.state, 'compras');
    g.state.monitors.settings.comprasShare = 1;
    g.state.levels = { cafe: 1 };
    coins(g.state, 1e6);
    for (let i = 0; i < 5; i += 1) step(g, 30_000);
    expect(g.state.levels.sql).toBeUndefined();
    expect(g.state.levels.iot).toBeUndefined();
    expect(g.state.levels.cafe).toBeGreaterThan(1);
  });

  it('never buys click upgrades', () => {
    const g = graduated();
    employ(g.state, 'compras');
    g.state.monitors.settings.comprasShare = 1;
    g.state.levels = { cafe: 1 };
    coins(g.state, 1e6);
    for (let i = 0; i < 5; i += 1) step(g, 30_000);
    expect(g.state.levels.joinha).toBeUndefined();
  });

  it('spends at most the chosen share of the coins on one purchase', () => {
    const g = graduated();
    employ(g.state, 'compras');
    g.state.levels = { cafe: 1 };
    coins(g.state, 100);
    g.state.monitors.settings.comprasShare = 0.1; // budget 10 coins; the next cafe costs 12
    step(g, 1000);
    expect(g.state.levels.cafe).toBe(1);

    setMonitorSettings(g.state, { comprasShare: 0.25 }); // budget ~25 coins
    step(g, 1000);
    expect(g.state.levels.cafe).toBe(2);
  });

  it('acts once per delay and faster at higher levels', () => {
    const slow = graduated();
    employ(slow.state, 'compras', 1);
    slow.state.monitors.settings.comprasShare = 1;
    slow.state.levels = { cafe: 1 };
    coins(slow.state, 1e6);
    step(slow, 1000);
    step(slow, 10_000);
    expect(slow.state.levels.cafe).toBe(2);
    step(slow, 10_000); // 20 s after the first purchase
    expect(slow.state.levels.cafe).toBe(3);

    const quick = graduated();
    employ(quick.state, 'compras', 4);
    quick.state.monitors.settings.comprasShare = 1;
    quick.state.levels = { cafe: 1 };
    coins(quick.state, 1e6);
    step(quick, 1000);
    step(quick, 2500);
    step(quick, 2500);
    expect(quick.state.levels.cafe).toBe(4);
  });

  it('leaves no trace in the counters the manual achievements read, nor in sprint progress', () => {
    const g = graduated();
    hire(g.state, 'b1');
    employ(g.state, 'compras', 4);
    g.state.monitors.settings.comprasShare = 1;
    g.state.levels = { cafe: 1 };
    g.state.sprint.active = { def: 'spr-buy', startedAt: T0, endsAt: T0 + 1e9, progress: 0, target: 3 };
    coins(g.state, 1e6);
    for (let i = 0; i < 6; i += 1) step(g, 2500);
    expect(g.state.levels.cafe).toBeGreaterThan(3);
    expect(g.state.counters.levelsBought).toBe(0);
    expect(g.state.counters.biggestPurchase).toBe(0);
    expect(g.state.run.levelsBought).toBe(0);
    expect(g.state.sprint.active?.progress).toBe(0);
    expect(g.state.counters.clicks).toBe(0);
  });

  it('stops when switched off and resumes when switched on', () => {
    const g = graduated();
    employ(g.state, 'compras');
    g.state.monitors.settings.comprasShare = 1;
    g.state.levels = { cafe: 1 };
    coins(g.state, 1e6);
    setMonitorOn(g.state, 'compras', false);
    for (let i = 0; i < 4; i += 1) step(g, 30_000);
    expect(g.state.levels.cafe).toBe(1);
    setMonitorOn(g.state, 'compras', true);
    step(g, 1000);
    expect(g.state.levels.cafe).toBe(2);
  });

  it('does not count as the player acting', () => {
    const g = graduated();
    employ(g.state, 'compras');
    g.state.monitors.settings.comprasShare = 1;
    g.state.levels = { cafe: 1 };
    coins(g.state, 1e6);
    step(g, 1000);
    expect(g.state.levels.cafe).toBe(2);
    expect(g.state.session.activeAt).toBe(T0);
  });
});

describe('Pesquisa', () => {
  it('buys the cheapest open research that fits the limit, and nothing locked', () => {
    const g = graduated();
    employ(g.state, 'pesquisa');
    g.state.monitors.settings.pesquisaShare = 1;
    coins(g.state, 65);
    step(g, 1000);
    // r-clickpower (50) is the cheapest; r-crit needs it, r-prof-gladimir needs Gladimir hired
    expect(g.state.research).toEqual({ 'r-clickpower': true });
    expect(g.state.monitors.units.pesquisa).toMatchObject({ done: 1, last: 'r-clickpower' });
    expect(g.state.counters.researchBought).toBe(0);
  });

  it('keeps a reserve: the research must cost at most the chosen share of the coins', () => {
    const g = graduated();
    employ(g.state, 'pesquisa');
    g.state.monitors.settings.pesquisaShare = 0.5;
    coins(g.state, 90); // budget 45 < 50
    step(g, 1000);
    expect(g.state.research).toEqual({});
    coins(g.state, 120); // budget 60 >= 50
    step(g, 1000);
    expect(g.state.research['r-clickpower']).toBe(true);
  });

  it('buys one per delay', () => {
    const g = graduated();
    employ(g.state, 'pesquisa');
    g.state.monitors.settings.pesquisaShare = 1;
    coins(g.state, 1e6);
    step(g, 1000);
    step(g, 10_000);
    expect(Object.keys(g.state.research)).toHaveLength(1);
    step(g, 30_000);
    expect(Object.keys(g.state.research)).toHaveLength(2);
  });
});

describe('Segurança', () => {
  it('lets the player act first, then defends for its share of the reward', () => {
    const g = graduated();
    hire(g.state, 'wagner');
    employ(g.state, 'seguranca');
    startInvasion(g);
    step(g, 4000);
    expect(g.state.invasion).not.toBeNull();
    const before = g.state.coins;
    step(g, 1000);
    expect(g.state.invasion).toBeNull();
    // phishing pays 60 s of production with a floor of 10 clicks of 1 coin; the monitor takes 35%
    expect(num(g.state.coins.sub(before))).toBeCloseTo(3.5, 5);
    const defended = eventsOf(g.events, 'invasionDefended');
    expect(defended).toHaveLength(1);
    expect(defended[0]).toMatchObject({ byMonitor: true, def: 'phishing' });
    expect(g.state.nextInvasionAt).toBeGreaterThan(T0 + 5000);
  });

  it('pays more at higher levels, earlier', () => {
    const g = graduated();
    hire(g.state, 'wagner');
    employ(g.state, 'seguranca', 4);
    startInvasion(g);
    step(g, 2000);
    expect(g.state.invasion).toBeNull();
    expect(num(g.state.coins)).toBeCloseTo(8, 5); // 80% of 10
  });

  it('does not touch the streak, the defended counters nor the missed ones', () => {
    const g = graduated();
    hire(g.state, 'wagner');
    employ(g.state, 'seguranca');
    g.state.eventStreak = 4;
    g.state.counters.bestEventStreak = 4;
    startInvasion(g);
    step(g, 6000);
    expect(g.state.invasion).toBeNull();
    expect(g.state.eventStreak).toBe(4);
    expect(g.state.counters).toMatchObject({ eventsDefended: 0, eventsMissed: 0, bestEventStreak: 4 });
    expect(g.state.run).toMatchObject({ eventsDefended: 0, eventsMissed: 0 });
  });

  it('does not progress a "defend invasions" sprint', () => {
    const g = graduated();
    hire(g.state, 'wagner', 'b1');
    employ(g.state, 'seguranca');
    g.state.sprint.active = { def: 'spr-defend', startedAt: T0, endsAt: T0 + 1e9, progress: 0, target: 1 };
    startInvasion(g);
    step(g, 6000);
    expect(g.state.sprint.active?.progress).toBe(0);
  });

  it('pays a buff reward for the share of its duration', () => {
    const g = graduated();
    hire(g.state, 'wagner');
    employ(g.state, 'seguranca');
    startInvasion(g, 'ddos');
    step(g, 5000);
    const buff = g.state.buffs.find((entry) => entry.id === 'buff-ddos');
    expect(buff).toBeDefined();
    expect(buff!.endsAt - buff!.startedAt).toBeCloseTo(30_000 * 0.35, 5);
  });

  it('does not shorten a longer buff that is already running', () => {
    const g = graduated();
    hire(g.state, 'wagner');
    employ(g.state, 'seguranca');
    startInvasion(g, 'ddos');
    g.state.buffs.push({ id: 'buff-ddos', name: 'Calma', emoji: '🧘', effects: [], startedAt: T0, endsAt: T0 + 60_000, source: 'invasion' });
    step(g, 5000);
    expect(g.state.buffs.find((entry) => entry.id === 'buff-ddos')?.endsAt).toBe(T0 + 60_000);
  });

  it('leaves an invasion the player already defended alone', () => {
    const g = graduated();
    hire(g.state, 'wagner');
    employ(g.state, 'seguranca');
    startInvasion(g);
    for (let i = 0; i < 3; i += 1) hitInvasion(g.state, g.content, T0 + 100 * (i + 1), g.rng, g.emit);
    expect(g.state.counters.eventsDefended).toBe(1);
    step(g, 6000);
    expect(eventsOf(g.events, 'invasionDefended').filter((e) => e.byMonitor)).toHaveLength(0);
  });

  it('does nothing when switched off, and an escaped invasion still counts as missed', () => {
    const g = graduated();
    hire(g.state, 'wagner');
    employ(g.state, 'seguranca');
    setMonitorOn(g.state, 'seguranca', false);
    startInvasion(g);
    step(g, 11_000);
    expect(g.state.counters.eventsMissed).toBe(1);
    expect(g.state.eventStreak).toBe(0);
  });
});

describe('Sprints', () => {
  function offered(ids: string[], mutate?: Parameters<typeof newCleanGame>[0]): TestGame {
    const g = graduated(mutate);
    hire(g.state, 'wagner', 'b1');
    employ(g.state, 'sprints');
    g.state.sprint.offers = ids;
    g.state.sprint.nextOffersAt = T0 + 1e9;
    return g;
  }

  it('waits its delay, then accepts the first offer and marks the sprint as its own', () => {
    const g = offered(['spr-crits', 'spr-buy', 'spr-clicks']);
    step(g, 1000); // arms the delay (30 s)
    step(g, 20_000);
    expect(g.state.sprint.active).toBeNull();
    step(g, 10_000);
    expect(g.state.sprint.active).toMatchObject({ def: 'spr-crits', auto: true });
    expect(g.state.sprint.offers).toEqual([]);
    expect(g.state.monitors.units.sprints).toMatchObject({ done: 1, last: 'spr-crits' });
  });

  it('"only the click ones" skips goals that need purchases or defences', () => {
    const g = offered(['spr-buy', 'spr-defend', 'spr-earn']);
    g.state.monitors.settings.sprintPick = 'clicks';
    step(g, 1000);
    step(g, 30_000);
    expect(g.state.sprint.active?.def).toBe('spr-earn');

    const h = offered(['spr-buy', 'spr-defend']);
    h.state.monitors.settings.sprintPick = 'clicks';
    step(h, 1000);
    step(h, 60_000);
    expect(h.state.sprint.active).toBeNull();
    expect(h.state.sprint.offers).toEqual(['spr-buy', 'spr-defend']);
  });

  it('"best reward" takes the offer worth the most', () => {
    const g = offered(['spr-clicks', 'spr-crits', 'spr-combo'], (content) => {
      const crits = content.sprints.find((def) => def.id === 'spr-crits');
      if (crits) crits.reward = { kind: 'coins', seconds: 500 };
    });
    g.state.monitors.settings.sprintPick = 'best';
    step(g, 1000);
    step(g, 30_000);
    expect(g.state.sprint.active?.def).toBe('spr-crits');
  });

  it('does not take an offer the player accepted first', () => {
    const g = offered(['spr-crits', 'spr-clicks']);
    step(g, 1000);
    acceptSprint(g.state, g.content, 'spr-clicks', g.state.lastTickAt, g.emit);
    step(g, 40_000);
    expect(g.state.sprint.active).toMatchObject({ def: 'spr-clicks' });
    expect(g.state.sprint.active?.auto).toBeUndefined();
  });

  it('a sprint it took that runs out is not a failure; one the player took is', () => {
    const g = offered(['spr-crits']);
    step(g, 1000);
    step(g, 30_000);
    expect(g.state.sprint.active?.auto).toBe(true);
    step(g, 70_000);
    expect(g.state.sprint.active).toBeNull();
    expect(g.state.counters.sprintsFailed).toBe(0);
    expect(g.state.run.sprintsFailed).toBe(0);
    expect(eventsOf(g.events, 'sprintFailed')).toHaveLength(1);

    const h = offered(['spr-crits']);
    h.state.monitors.units.sprints.on = false;
    acceptSprint(h.state, h.content, 'spr-crits', T0, h.emit);
    step(h, 70_000);
    expect(h.state.counters.sprintsFailed).toBe(1);
  });

  it('a sprint it took and the player finished counts as completed', () => {
    const g = offered(['spr-crits']);
    step(g, 1000);
    step(g, 30_000);
    const active = g.state.sprint.active;
    expect(active?.auto).toBe(true);
    if (active) active.progress = active.target;
    step(g, 1000);
    expect(g.state.counters.sprintsCompleted).toBe(1);
  });
});

describe('save and view', () => {
  it('round-trips levels, switches, settings and tallies', () => {
    const g = graduated();
    employ(g.state, 'compras', 3);
    employ(g.state, 'sprints', 2);
    g.state.monitors.units.sprints.on = false;
    g.state.monitors.units.compras.done = 12;
    g.state.monitors.units.compras.last = 'cafe';
    g.state.monitors.settings = { comprasShare: 0.25, pesquisaShare: 1, sprintPick: 'best' };
    const loaded = deserializeState(serializeState(g.state), g.content, T0);
    expect(loaded?.monitors).toEqual(g.state.monitors);
  });

  it('an old save without monitors loads with none hired, switched on', () => {
    const g = graduated();
    const raw = JSON.parse(serializeState(g.state)) as Record<string, unknown>;
    delete raw.monitors;
    const loaded = deserializeState(JSON.stringify(raw), g.content, T0);
    expect(loaded).not.toBeNull();
    for (const unit of Object.values(loaded!.monitors.units)) expect(unit).toMatchObject({ level: 0, on: true, done: 0 });
    expect(loaded!.monitors.settings).toEqual({ comprasShare: 0.5, pesquisaShare: 0.5, sprintPick: 'first' });
  });

  it('clamps a hand-edited save: levels to the content, settings to the offered values, unknown ids dropped', () => {
    const g = graduated();
    const raw = JSON.parse(serializeState(g.state)) as Record<string, unknown>;
    raw.monitors = {
      units: { compras: { level: 99, on: 'yes', nextAt: -5, done: -1, last: 'nope' }, ghost: { level: 3 } },
      settings: { comprasShare: 7, pesquisaShare: 'x', sprintPick: 'all' },
    };
    const loaded = deserializeState(JSON.stringify(raw), g.content, T0);
    expect(loaded!.monitors.units.compras).toEqual({ level: 4, on: true, nextAt: 0, done: 0, last: '' });
    expect(loaded!.monitors.settings).toEqual({ comprasShare: 0.5, pesquisaShare: 0.5, sprintPick: 'first' });
    expect('ghost' in loaded!.monitors.units).toBe(false);
  });

  it('describes each card: cost of the next level, what it does now, and why it idles', () => {
    const g = graduated();
    g.state.diplomas = 30;
    employ(g.state, 'seguranca', 2);
    const view = monitorsView(g.state, g.content);
    expect(view.unlocked).toBe(true);
    const compras = view.monitors.find((m) => m.id === 'compras');
    expect(compras).toMatchObject({ level: 0, cost: 5, affordable: true, nextLine: null });
    const guard = view.monitors.find((m) => m.id === 'seguranca');
    expect(guard).toMatchObject({ level: 2, cost: 140, affordable: false });
    expect(guard?.line).toContain('50%');
    expect(guard?.nextLine).toContain('65%');
    expect(guard?.idle).toContain('WAGNER');
  });
});

describe('monitor content', () => {
  it('has each monitor once, in the order of MONITOR_IDS', () => {
    expect(content.monitors.map((def) => def.id)).toEqual(['compras', 'seguranca', 'sprints', 'pesquisa']);
  });

  it('every level costs more diplomas, acts sooner, and has a line to show', () => {
    for (const def of content.monitors) {
      expect(def.levels.length).toBeGreaterThanOrEqual(2);
      def.levels.forEach((level, i) => {
        expect(level.line.length).toBeGreaterThan(0);
        const before = def.levels[i - 1];
        if (before) {
          expect(level.cost).toBeGreaterThan(before.cost);
          expect(level.delayMs).toBeLessThan(before.delayMs);
        }
      });
    }
  });

  it('the guard is always slower than the shortest invasion window and never pays the whole reward', () => {
    const guard = content.monitors.find((def) => def.id === 'seguranca');
    const shortest = Math.min(...content.invasions.map((def) => def.windowMs));
    for (const level of guard?.levels ?? []) {
      expect(level.share).toBeGreaterThan(0);
      expect(level.share).toBeLessThan(1);
      expect(level.delayMs).toBeLessThan(shortest);
    }
    const shares = (guard?.levels ?? []).map((level) => level.share ?? 0);
    expect(shares).toEqual([...shares].sort((a, b) => a - b));
  });
});
