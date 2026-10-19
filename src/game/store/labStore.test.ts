import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFixtureContent } from '../engine/__fixtures__/content';
import { Decimal } from '../engine/decimal';
import { createInitialState } from '../engine/init';
import { createRng } from '../engine/rng';
import { serializeState } from '../engine/save';
import type { GameState } from '../engine/state';
import { clearGameEventListeners } from './bus';
import { SAVE_KEY, createGameStore } from './createStore';
import type { StorageLike } from './createStore';
import type { GameEvent } from './types';

const T0 = 1_700_000_000_000;

function memoryStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

function setup(prepare: (state: GameState) => void) {
  const content = createFixtureContent();
  content.achievements = [];
  const storage = memoryStorage();
  const state = createInitialState(content, Date.now());
  prepare(state);
  storage.setItem(SAVE_KEY, serializeState(state));
  const events: GameEvent[] = [];
  const store = createGameStore({ content, storage: () => storage, rng: createRng(3), emit: (event) => events.push(event) });
  store.getState().boot();
  return { store, events, content, storage };
}

/** Pablo hired, 150 diplomas, every aula at level 1 and the coins to spend. */
function labReady(state: GameState, content = createFixtureContent()): void {
  state.hired.pablo = true;
  state.diplomas = 150;
  state.diplomasEarned = 150;
  for (const def of content.disciplines) state.levels[def.id] = 1;
  state.coins = new Decimal('1e30');
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
  clearGameEventListeners();
});

describe('Laboratório actions in the store', () => {
  it('unlocks with diplomas, starts a run with a seed drawn from the store rng, and runs while open', () => {
    const { store, events } = setup((state) => labReady(state));
    const { getState } = store;
    expect(getState().unlockLab()).toBe(true);
    expect(getState().state.diplomas).toBe(120);
    expect(getState().unlockLab()).toBe(false);

    expect(getState().startLabRun()).toBe(true);
    const seed = getState().state.lab.turma.run!.seed;
    expect(seed).toBeGreaterThan(0);
    expect(getState().startLabRun()).toBe(false); // once per turma
    expect(events.map((event) => event.type)).toEqual(expect.arrayContaining(['labUnlocked', 'labRunStarted']));

    vi.advanceTimersByTime(3000);
    const t = getState().state.lab.turma.run!.t;
    expect(t).toBeGreaterThan(2);

    getState().setLabOpen(false);
    vi.advanceTimersByTime(3000);
    expect(getState().state.lab.turma.run!.t).toBe(t); // paused while closed
    getState().setLabOpen(true);
    vi.advanceTimersByTime(1000);
    expect(getState().state.lab.turma.run!.t).toBeGreaterThan(t);
    store.getState().shutdown();
  });

  it('counts clicks on the monitor up to the limit', () => {
    const { store } = setup((state) => labReady(state));
    const { getState } = store;
    getState().unlockLab();
    getState().startLabRun();
    for (let i = 0; i < 40; i += 1) getState().labClick();
    expect(getState().state.lab.counters.clicks).toBe(5);
    vi.advanceTimersByTime(1100);
    getState().labClick();
    expect(getState().state.lab.counters.clicks).toBe(6);
    store.getState().shutdown();
  });

  it('takes rewards, levels items up with ADScoins and buys tree nodes', () => {
    const { store } = setup((state) => labReady(state));
    const { getState } = store;
    getState().unlockLab();
    getState().startLabRun();
    expect(getState().levelUpLabItem('ferramenta')).toBe(true);
    expect(getState().state.lab.turma.equipped.ferramenta!.level).toBe(2);
    expect(getState().levelUpLabItem('setup')).toBe(false);

    // let the fight play out until the first reward shows (the monitor may break first: then the tree is what is left to test)
    for (let i = 0; i < 400 && getState().state.lab.turma.run!.status === 'fighting'; i += 1) vi.advanceTimersByTime(500);
    const status = getState().state.lab.turma.run!.status;
    if (status === 'reward') {
      expect(getState().chooseLabReward(99)).toBe(false);
      expect(getState().chooseLabReward(0)).toBe(true);
    }
    expect(getState().buyLabNode('algoritmos-eficientes')).toBe(false); // no Commits yet
    store.getState().shutdown();
  });

  it('keeps the lab across a reload but starts it closed', () => {
    const first = setup((state) => labReady(state));
    first.store.getState().unlockLab();
    first.store.getState().startLabRun();
    vi.advanceTimersByTime(2000);
    first.store.getState().save();
    first.store.getState().shutdown();

    const content = first.content;
    const second = createGameStore({ content, storage: () => first.storage, rng: createRng(5), emit: () => undefined });
    second.getState().boot();
    const { lab } = second.getState().state;
    expect(lab.unlocked).toBe(true);
    expect(lab.open).toBe(false);
    expect(lab.turma.run?.status).toBe('fighting');
    second.getState().shutdown();
  });
});
