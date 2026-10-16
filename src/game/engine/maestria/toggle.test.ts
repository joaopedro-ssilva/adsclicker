import { describe, expect, it } from 'vitest';
import { PROFESSOR_IDS } from '../../content/types';
import { content } from '../../content';
import type { Emit, GameEvent } from '../../store/types';
import { buyDiscipline, graduate } from '../actions';
import { Decimal } from '../decimal';
import { createInitialState } from '../init';
import { createRng } from '../rng';
import { deserializeState, serializeState } from '../save';
import { computeStats } from '../stats';
import { advance } from '../tick';
import { festaView, joinhaView, rollforwardView, swarmView } from '../views';
import {
  activeFesta,
  buyAsset,
  buyMaestriaLevel,
  depositFund,
  fireRollforward,
  goldenActive,
  horasBandsFilled,
  maestriaActive,
  maestriaLevel,
  readMaestria,
  recordHoras,
  recordRollforwardClick,
  releaseMultiplier,
  sellAsset,
  setMaestriaEnabled,
  startFesta,
  startSwarm,
  swarmCharge,
  unlockMaestria,
  updateBolsa,
  maybeStartGolden,
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
  return { state, events, emit, rng: createRng(5) };
}

const off = (g: ReturnType<typeof game>, id: (typeof PROFESSOR_IDS)[number], now = T0) => setMaestriaEnabled(g.state, content, id, false, now, g.emit);
const on = (g: ReturnType<typeof game>, id: (typeof PROFESSOR_IDS)[number], now = T0) => setMaestriaEnabled(g.state, content, id, true, now, g.emit);

describe('switching a Maestria off', () => {
  it('only works on an unlocked Maestria, only changes the state, and emits the event', () => {
    const g = game({ edecio: 2 });
    expect(off(g, 'gladimir')).toBe(false);
    expect(on(g, 'edecio')).toBe(false);
    expect(off(g, 'edecio')).toBe(true);
    expect(off(g, 'edecio')).toBe(false);
    expect(g.state.maestria.disabled).toEqual({ edecio: true });
    expect(maestriaActive(g.state, 'edecio')).toBe(false);
    expect(g.events).toContainEqual({ type: 'maestriaToggle', professor: 'edecio', enabled: false });
    expect(on(g, 'edecio')).toBe(true);
    expect(g.state.maestria.disabled).toEqual({});
  });

  it('keeps the level, and unlocking and buying levels still work while off', () => {
    const g = game({ edecio: 1 });
    off(g, 'edecio');
    g.state.diplomas = 1000;
    expect(buyMaestriaLevel(g.state, content, 'edecio', g.emit)).toBe(true);
    expect(maestriaLevel(g.state, 'edecio')).toBe(2);
    expect(unlockMaestria(g.state, content, 'guto', g.emit)).toBe(true);
    expect(g.state.maestria.disabled.edecio).toBe(true);
  });

  it('Joinha: no golden mode, the running one stops, the recharge is paused', () => {
    const g = game({ edecio: 3 });
    const stats = computeStats(g.state, content);
    g.state.combo.steps = stats.comboMax;
    expect(maybeStartGolden(g.state, content, stats, T0, g.emit)).toBe(true);
    expect(goldenActive(g.state, T0 + 1000)).toBe(true);
    const readyAt = g.state.maestria.joinha.readyAt;
    off(g, 'edecio', T0 + 1000);
    expect(goldenActive(g.state, T0 + 1001)).toBe(false);
    expect(maybeStartGolden(g.state, content, stats, T0 + 10 * 3_600_000, g.emit)).toBe(false);
    expect(joinhaView(g.state, content, T0 + 1001)).toBeNull();
    on(g, 'edecio', T0 + 1000 + 500_000);
    expect(g.state.maestria.joinha.readyAt).toBe(readyAt + 500_000);
  });

  it('Rollforward: charges neither fill nor fire, and the stored ones wait', () => {
    const g = game({ gladimir: 3 });
    g.state.maestria.rollforward = { clicks: 0, charges: 2 };
    off(g, 'gladimir');
    expect(fireRollforward(g.state, content, g.emit)).toBe(false);
    for (let i = 0; i < 1000; i += 1) recordRollforwardClick(g.state, content);
    expect(g.state.maestria.rollforward).toEqual({ clicks: 0, charges: 2 });
    expect(rollforwardView(g.state, content)).toBeNull();
    on(g, 'gladimir');
    expect(fireRollforward(g.state, content, g.emit)).toBe(true);
  });

  it('Super invasao: no start, a running swarm ends paying what was defeated, the charge does not grow while off', () => {
    const g = game({ wagner: 1 });
    advance(g.state, content, T0 + 1000, g.rng, g.emit);
    const hour = (content.maestrias.swarm.chargeMinutes[0] ?? 60) * 60_000;
    const ready = T0 + 1000 + hour;
    expect(startSwarm(g.state, content, ready, g.emit)).toBe(true);
    off(g, 'wagner', ready + 100);
    expect(g.state.maestria.swarm.active).toBeNull();
    expect(g.events.some((e) => e.type === 'swarmEnd')).toBe(true);
    expect(swarmView(g.state, content, ready + 200)).toBeNull();
    // A whole charge passes while off: re-enabling must not make it ready.
    const back = ready + 100 + hour * 2;
    expect(startSwarm(g.state, content, back, g.emit)).toBe(false);
    on(g, 'wagner', back);
    expect(swarmCharge(g.state, content, back)).toBeCloseTo(100 / hour, 5);
    expect(startSwarm(g.state, content, back, g.emit)).toBe(false);
  });

  it('Super invasao: the Rollforward of another Maestria does not fill a paused charge', () => {
    const g = game({ wagner: 1, gladimir: 1 });
    advance(g.state, content, T0 + 1000, g.rng, g.emit);
    off(g, 'wagner', T0 + 2000);
    const since = g.state.maestria.swarm.since;
    shiftMaestriaTimers(g.state, 3_600_000);
    expect(g.state.maestria.swarm.since).toBe(since);
  });

  it('Festa: no start, the running party ends, and re-enabling does not give the charge back', () => {
    const g = game({ guto: 5 });
    advance(g.state, content, T0 + 1000, g.rng, g.emit);
    const recharge = atLevel(content.maestrias.festa.rechargeMinutes, 5) * 60_000;
    const ready = T0 + 1000 + recharge;
    expect(startFesta(g.state, content, ready, g.emit)).toBe(true);
    expect(activeFesta(g.state, ready + 1)).not.toBeNull();
    off(g, 'guto', ready + 1000);
    expect(activeFesta(g.state, ready + 1001)).toBeNull();
    expect(festaView(g.state, content, ready + 1001)).toBeNull();
    const later = ready + recharge * 3;
    expect(startFesta(g.state, content, later, g.emit)).toBe(false);
    on(g, 'guto', later);
    expect(startFesta(g.state, content, later, g.emit)).toBe(false);
    expect(startFesta(g.state, content, later + recharge, g.emit)).toBe(true);
  });

  it('Horas: nothing is counted while off, and the bar pays nothing', () => {
    const g = game({ angelo: 3 });
    recordHoras(g.state, content, 'clicks', 100);
    const counted = g.state.maestria.horas.clicks;
    expect(counted).toBeGreaterThan(0);
    off(g, 'angelo');
    recordHoras(g.state, content, 'clicks', 100);
    expect(g.state.maestria.horas.clicks).toBe(counted);
    expect(horasBandsFilled(g.state, content)).toBe(0);
  });

  it('Releases (B1): no production bonus while off', () => {
    const g = game({ b1: 5 });
    g.state.run.sprintsCompleted = 500;
    expect(releaseMultiplier(g.state, content)).toBeGreaterThan(1);
    off(g, 'b1');
    expect(releaseMultiplier(g.state, content)).toBe(1);
    on(g, 'b1');
    expect(releaseMultiplier(g.state, content)).toBeGreaterThan(1);
  });

  it('Design System (B2): no free levels while off', () => {
    const g = game({ b2: 5 });
    off(g, 'b2');
    const dear = content.disciplines.filter((def) => def.professor === 'pablo')[0]!;
    for (const def of content.disciplines) g.state.levels[def.id] = def.id === dear.id ? 5 : 3;
    buyDiscipline(g.state, content, dear.id, T0, g.emit, () => 0);
    expect(g.events.some((e) => e.type === 'designSystem')).toBe(false);
  });

  it('Bolsa: holdings freeze, cannot be traded, the market and its liquidity pause, graduation still cashes in', () => {
    const g = game({ pablo: 5 });
    g.state.research['edecio-aula-show'] = true;
    for (const def of content.disciplines) g.state.levels[def.id] = 20;
    updateBolsa(g.state, content, T0, g.rng);
    expect(depositFund(g.state, content, 0.5, g.emit)).toBe(true);
    const asset = content.maestrias.bolsa.assets[0]!;
    expect(buyAsset(g.state, content, asset.id, 0.2, g.emit)).toBe(true);
    const held = g.state.maestria.bolsa.fund.units;
    off(g, 'pablo', T0 + 1000);
    expect(buyAsset(g.state, content, asset.id, 0.2, g.emit)).toBe(false);
    expect(sellAsset(g.state, content, asset.id, 1, g.emit)).toBe(false);
    expect(depositFund(g.state, content, 0.1, g.emit)).toBe(false);
    expect(withdrawFund(g.state, content, 1, g.emit)).toBe(false);
    const step = g.state.maestria.bolsa.step;
    updateBolsa(g.state, content, T0 + 50 * 3_600_000, g.rng);
    expect(g.state.maestria.bolsa.step).toBe(step);
    expect(g.state.maestria.bolsa.fund.units).toEqual(held);
    on(g, 'pablo', T0 + 50 * 3_600_000);
    updateBolsa(g.state, content, T0 + 50 * 3_600_000 + 1000, g.rng);
    expect(g.state.maestria.bolsa.step).toBe(step);
    expect(sellAsset(g.state, content, asset.id, 1, g.emit)).toBe(true);
  });
});

describe('persistence', () => {
  it('survives a save round-trip and an old save without the field loads as everything on', () => {
    const g = game({ edecio: 3, guto: 2 });
    off(g, 'guto', T0 + 5000);
    const back = deserializeState(serializeState(g.state), content, T0);
    expect(back?.maestria.disabled).toEqual({ guto: true });
    expect(back?.maestria.pausedAt).toEqual({ guto: T0 + 5000 });

    const raw = JSON.parse(serializeState(g.state)) as { maestria: Record<string, unknown> };
    delete raw.maestria.disabled;
    delete raw.maestria.pausedAt;
    const old = deserializeState(JSON.stringify(raw), content, T0);
    expect(old?.maestria.disabled).toEqual({});
    expect(old?.maestria.levels).toEqual({ edecio: 3, guto: 2 });
  });

  it('the reader drops unknown ids, non-unlocked ones and non-true values', () => {
    const read = readMaestria({ levels: { edecio: 2 }, disabled: { edecio: true, guto: true, nobody: true, wagner: 'yes' }, pausedAt: { edecio: 'x' } }, content);
    expect(read.disabled).toEqual({ edecio: true });
    expect(read.pausedAt).toEqual({ edecio: 0 });
  });

  it('a graduation leaves the choice as the player left it, and the Bolsa still pays out', () => {
    const g = game({ edecio: 1, guto: 1, angelo: 2 });
    off(g, 'guto');
    off(g, 'angelo');
    g.state.runCoins = new Decimal('2e21');
    expect(graduate(g.state, content, T0 + 1000, g.emit)).toBe(true);
    expect(g.state.maestria.disabled).toEqual({ guto: true, angelo: true });
    expect(maestriaActive(g.state, 'edecio')).toBe(true);
  });
});
