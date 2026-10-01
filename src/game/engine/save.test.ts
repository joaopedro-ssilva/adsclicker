import { describe, expect, it } from 'vitest';
import { acceptSprint, buyDiscipline } from './actions';
import { Decimal } from './decimal';
import { createInitialState } from './init';
import {
  MIGRATIONS,
  deserializeState,
  exportSave,
  importSave,
  migrateSave,
  serializeState,
} from './save';
import { SAVE_VERSION } from './state';
import type { GameState } from './state';
import { advance } from './tick';
import { hire, newGame, T0 } from './__fixtures__/helpers';

/** A state with something in every field. */
function richGame() {
  const g = newGame();
  hire(g.state, 'gladimir', 'b2', 'wagner', 'b1');
  g.state.coins = new Decimal('1.2345e50');
  g.state.runCoins = new Decimal('9.9e49');
  g.state.lifetimeCoins = new Decimal('5e60');
  g.state.diplomas = 7;
  g.state.diplomasEarned = 12;
  g.state.activeProfessor = 'gladimir';
  g.state.levels = { cafe: 42, joinha: 7, sql: 3 };
  g.state.research = { 'r-clickpower': true, 'r-offline': true };
  g.state.prestige = { 'core-power': 2 };
  g.state.buyAmount = 'max';
  g.state.achievements = { 'a-clicks': T0 + 5 };
  g.state.secrets = { konami: true };
  g.state.skins['edecio-cafe'] = true;
  g.state.equippedSkin.edecio = 'edecio-cafe';
  g.state.sceneries['laboratorio'] = true;
  g.state.equippedScenery = 'laboratorio';
  g.state.themes['claro'] = true;
  g.state.equippedTheme = 'claro';
  g.state.combo = { steps: 4.5, lastClickAt: T0 + 100 };
  g.state.autoClickCarry = 0.25;
  g.state.buffs.push({
    id: 'buff-scale',
    name: 'Auto Scaling',
    emoji: '☁️',
    effects: [{ stat: 'idlePower', op: 'mult', value: 5 }],
    startedAt: T0,
    endsAt: T0 + 30_000,
    source: 'ability',
  });
  g.state.abilityReadyAt = { 'auto-scaling': T0 + 600_000 };
  g.state.invasion = { uid: 9, def: 'ddos', spawnedAt: T0, expiresAt: T0 + 8000, clicksLeft: 4, x: 0.3, y: 0.7 };
  g.state.nextInvasionAt = T0 + 90_000;
  g.state.invasionSeq = 9;
  g.state.eventStreak = 3;
  g.state.sprint = {
    offers: ['spr-clicks'],
    active: { def: 'spr-earn', startedAt: T0, endsAt: T0 + 60_000, progress: 12.5, target: 30, refCps: '1.5e12' },
    nextOffersAt: T0 + 5000,
  };
  g.state.counters.clicks = 4321;
  g.state.counters.playSeconds = 99.5;
  g.state.settings = { ...g.state.settings, muted: true, sfxVolume: 0.2, reducedMotion: 'on' };
  g.state.lastTickAt = T0 + 1000;
  g.state.lastSavedAt = T0 + 900;
  return g;
}

function expectSameState(a: GameState, b: GameState): void {
  expect(serializeState(a)).toBe(serializeState(b));
  // The decimal text is a shortest round trip, so the values agree to float precision.
  expect(a.coins.sub(b.coins).abs().lte(a.coins.mul(1e-12))).toBe(true);
  expect(a.lifetimeCoins.sub(b.lifetimeCoins).abs().lte(a.lifetimeCoins.mul(1e-12))).toBe(true);
}

describe('save round trip', () => {
  it('serialises and reads back every field', () => {
    const { state, content } = richGame();
    const loaded = deserializeState(serializeState(state), content, T0 + 5000)!;
    expect(loaded).not.toBeNull();
    expectSameState(state, loaded);
    expect(loaded.coins).toBeInstanceOf(Decimal);
    expect(loaded.coins.toString()).toBe(state.coins.toString());
    expect(loaded.levels).toEqual(state.levels);
    expect(loaded.buffs).toEqual(state.buffs);
    expect(loaded.sprint).toEqual(state.sprint);
    expect(loaded.invasion).toEqual(state.invasion);
    expect(loaded.combo).toEqual(state.combo);
    expect(loaded.settings).toEqual(state.settings);
    expect(loaded.counters).toEqual(state.counters);
  });

  it('writes decimals as strings', () => {
    const { state } = richGame();
    const raw = JSON.parse(serializeState(state));
    expect(typeof raw.coins).toBe('string');
    expect(typeof raw.runCoins).toBe('string');
    expect(typeof raw.lifetimeCoins).toBe('string');
    expect(raw.version).toBe(SAVE_VERSION);
  });

  it('survives a long play session', () => {
    const g = newGame();
    hire(g.state, 'b1');
    g.state.coins = new Decimal(1e6);
    for (let i = 0; i < 5; i += 1) buyDiscipline(g.state, g.content, 'cafe', T0, g.emit);
    advance(g.state, g.content, T0 + 120_000, g.rng, g.emit);
    acceptSprint(g.state, g.content, g.state.sprint.offers[0] ?? '', T0 + 120_000, g.emit);
    const loaded = deserializeState(serializeState(g.state), g.content, T0 + 130_000)!;
    expectSameState(g.state, loaded);
  });

  it('exports and imports as base64', () => {
    const { state, content } = richGame();
    const text = exportSave(state);
    expect(text).toMatch(/^[A-Za-z0-9+/]+=*$/);
    const imported = importSave(text, content, T0 + 5000)!;
    expectSameState(state, imported);
  });

  it('imports with stray whitespace and raw JSON too', () => {
    const { state, content } = richGame();
    const text = exportSave(state);
    expect(importSave(`  ${text.slice(0, 20)}\n${text.slice(20)}  `, content, T0)).not.toBeNull();
    expect(importSave(serializeState(state), content, T0)).not.toBeNull();
  });
});

describe('corrupt or foreign saves', () => {
  const { content } = newGame();

  it('returns null and never throws', () => {
    const garbage = ['', '   ', 'not json', '{', '[]', 'null', '42', '"text"', '{"version":"1"}', '{}', '{"coins":5}', '\u0000\u0001'];
    for (const text of garbage) {
      expect(deserializeState(text, content, T0), JSON.stringify(text)).toBeNull();
      expect(importSave(text, content, T0), JSON.stringify(text)).toBeNull();
    }
  });

  it('rejects base64 that is not a save', () => {
    expect(importSave(btoa('hello world'), content, T0)).toBeNull();
    expect(importSave('%%%%', content, T0)).toBeNull();
  });
});

describe('tolerant merge', () => {
  const { content } = newGame();

  it('fills missing fields from a fresh game', () => {
    const state = deserializeState('{"version":1,"coins":"250"}', content, T0)!;
    const fresh = createInitialState(content, T0);
    expect(state.coins.toNumber()).toBe(250);
    expect(state.hired).toEqual(fresh.hired);
    expect(state.skins).toEqual(fresh.skins);
    expect(state.equippedSkin).toEqual(fresh.equippedSkin);
    expect(state.counters).toEqual(fresh.counters);
    expect(state.settings).toEqual(fresh.settings);
    expect(state.sprint).toEqual(fresh.sprint);
    expect(state.activeProfessor).toBe('edecio');
  });

  it('drops ids that no longer exist in the content', () => {
    const { state } = richGame();
    const raw = JSON.parse(serializeState(state));
    raw.levels.ghost = 9;
    raw.research.ghost = true;
    raw.prestige.ghost = 2;
    raw.achievements.ghost = T0;
    raw.skins.ghost = true;
    raw.sceneries.ghost = true;
    raw.themes.ghost = true;
    raw.abilityReadyAt.ghost = T0;
    raw.secrets.ghost = true;
    raw.hired.ghost = true;
    raw.buffs.push({ id: 'ghost', startedAt: T0, endsAt: T0 + 1, source: 'ability' });
    raw.sprint.offers.push('ghost');
    raw.extraField = 'ignored';
    const loaded = deserializeState(JSON.stringify(raw), content, T0 + 5000)!;
    for (const key of ['levels', 'research', 'prestige', 'achievements', 'skins', 'sceneries', 'themes', 'abilityReadyAt', 'secrets'] as const) {
      expect(loaded[key], key).not.toHaveProperty('ghost');
    }
    expect(loaded.hired).not.toHaveProperty('ghost');
    expect(loaded.buffs.map((b) => b.id)).toEqual(['buff-scale']);
    expect(loaded.sprint.offers).toEqual(['spr-clicks']);
    expect(loaded).not.toHaveProperty('extraField');
  });

  it('drops an invasion or sprint of a removed definition', () => {
    const { state } = richGame();
    const raw = JSON.parse(serializeState(state));
    raw.invasion.def = 'ghost';
    raw.sprint.active.def = 'ghost';
    const loaded = deserializeState(JSON.stringify(raw), content, T0 + 5000)!;
    expect(loaded.invasion).toBeNull();
    expect(loaded.sprint.active).toBeNull();
  });

  it('repairs invalid values', () => {
    const raw = {
      version: 1,
      coins: '-50',
      runCoins: 'abc',
      lifetimeCoins: 12,
      diplomas: -3,
      diplomasEarned: 'x',
      activeProfessor: 'pablo', // not hired
      hired: { edecio: false, gladimir: 'yes' },
      levels: { cafe: -5, sql: 2.7, joinha: 'a' },
      prestige: { 'core-power': 99 }, // above max level 3
      buyAmount: 7,
      equippedSkin: { edecio: 'gladimir-default', gladimir: 'gladimir-dba' }, // wrong professor / not owned
      equippedScenery: 'laboratorio', // not owned
      equippedTheme: 'ghost',
      settings: { sfxVolume: 5, musicVolume: -1, muted: 'no', reducedMotion: 'sometimes' },
      counters: { clicks: -9, crits: 'x', maxCombo: 7 },
      lastTickAt: T0 + 1e9, // in the future
    };
    const state = deserializeState(JSON.stringify(raw), content, T0)!;
    expect(state.coins.toNumber()).toBe(0);
    expect(state.runCoins.toNumber()).toBe(0);
    expect(state.lifetimeCoins.toNumber()).toBe(12);
    expect(state.diplomas).toBe(0);
    expect(state.diplomasEarned).toBe(0);
    expect(state.hired.edecio).toBe(true); // the first professor is always hired
    expect(state.hired.gladimir).toBe(false);
    expect(state.activeProfessor).toBe('edecio');
    expect(state.levels).toEqual({ sql: 2 });
    expect(state.prestige).toEqual({ 'core-power': 3 });
    expect(state.buyAmount).toBe(1);
    expect(state.equippedSkin.edecio).toBe('edecio-default');
    expect(state.equippedSkin.gladimir).toBe('gladimir-default');
    expect(state.equippedScenery).toBe('sala');
    expect(state.equippedTheme).toBe('escuro');
    expect(state.settings).toMatchObject({ sfxVolume: 1, musicVolume: 0, muted: false, reducedMotion: 'system' });
    expect(state.counters.clicks).toBe(0);
    expect(state.counters.crits).toBe(0);
    expect(state.counters.maxCombo).toBe(7);
    expect(state.lastTickAt).toBe(T0);
  });

  it('re-grants cosmetics of unlocked achievements that were added after the save', () => {
    const { state } = richGame();
    const raw = JSON.parse(serializeState(state));
    delete raw.skins['edecio-cafe'];
    const loaded = deserializeState(JSON.stringify(raw), content, T0 + 5000)!;
    expect(loaded.skins['edecio-cafe']).toBe(true); // 'a-clicks' is unlocked and rewards it
  });

  it('always owns the default cosmetics', () => {
    const loaded = deserializeState('{"version":1,"skins":{},"sceneries":{},"themes":{}}', content, T0)!;
    expect(loaded.skins['edecio-default']).toBe(true);
    expect(loaded.sceneries['sala']).toBe(true);
    expect(loaded.themes['escuro']).toBe(true);
  });
});

describe('migrations', () => {
  it('exposes the migration list', () => {
    expect(Array.isArray(MIGRATIONS)).toBe(true);
    expect(MIGRATIONS.length).toBeGreaterThanOrEqual(SAVE_VERSION - 1);
  });

  it('runs each step from the save version up to the target', () => {
    const migrations = [
      (raw: Record<string, unknown>) => ({ ...raw, coins: raw.oldCoins, oldCoins: undefined }),
      (raw: Record<string, unknown>) => ({ ...raw, diplomas: Number(raw.diplomas ?? 0) + 100 }),
    ];
    const migrated = migrateSave({ version: 1, oldCoins: '55', diplomas: 1 }, migrations, 3);
    expect(migrated).toMatchObject({ version: 3, coins: '55', diplomas: 101 });

    const partial = migrateSave({ version: 2, diplomas: 1 }, migrations, 3);
    expect(partial).toMatchObject({ version: 3, diplomas: 101 });
  });

  it('leaves a current save alone and treats a missing version as 1', () => {
    expect(migrateSave({ version: 3, a: 1 }, [() => ({ boom: true })], 3)).toEqual({ version: 3, a: 1 });
    expect(migrateSave({ a: 1 }, [(raw) => ({ ...raw, migrated: true })], 2)).toMatchObject({ migrated: true, version: 2 });
  });

  it('skips a missing step instead of failing', () => {
    expect(migrateSave({ version: 1 }, [], 3)).toMatchObject({ version: 3 });
  });
});
