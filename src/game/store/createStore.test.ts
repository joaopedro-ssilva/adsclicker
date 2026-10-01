import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFixtureContent } from '../engine/__fixtures__/content';
import { Decimal } from '../engine/decimal';
import { createInitialState } from '../engine/init';
import { createRng } from '../engine/rng';
import { serializeState } from '../engine/save';
import type { GameState } from '../engine/state';
import { clearGameEventListeners, subscribeGameEvents } from './bus';
import { AUTOSAVE_MS, SAVE_DEBOUNCE_MS, SAVE_KEY, createGameStore } from './createStore';
import type { StorageLike } from './createStore';
import type { GameEvent } from './types';

const T0 = 1_700_000_000_000;

interface MemoryStorage extends StorageLike {
  data: Map<string, string>;
  writes: number;
}

function memoryStorage(): MemoryStorage {
  const data = new Map<string, string>();
  return {
    data,
    writes: 0,
    getItem(key) {
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      this.writes += 1;
      data.set(key, value);
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

function setup(prepare?: (state: GameState) => void, storage = memoryStorage()) {
  const content = createFixtureContent();
  content.achievements = [];
  if (prepare) {
    const state = createInitialState(content, Date.now());
    prepare(state);
    storage.data.set(SAVE_KEY, serializeState(state));
    storage.writes = 0;
  }
  const events: GameEvent[] = [];
  const store = createGameStore({
    content,
    storage: () => storage,
    rng: createRng(3),
    emit: (event) => events.push(event),
  });
  return { store, storage, events, content };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
  clearGameEventListeners();
});

describe('boot', () => {
  it('starts not ready, with a fresh state, and touches no storage until boot', () => {
    const { store, storage } = setup();
    expect(store.getState().ready).toBe(false);
    expect(store.getState().offlineReport).toBeNull();
    expect(storage.writes).toBe(0);
  });

  it('loads a fresh game when there is no save', () => {
    const { store } = setup();
    store.getState().boot();
    const { state, ready } = store.getState();
    expect(ready).toBe(true);
    expect(state.hired.edecio).toBe(true);
    expect(state.coins.toNumber()).toBe(0);
    expect(state.lastTickAt).toBe(T0);
    store.getState().shutdown();
  });

  it('is idempotent: a second boot does not start a second loop', () => {
    const { store } = setup();
    store.getState().boot();
    store.getState().boot();
    vi.advanceTimersByTime(1000);
    expect(store.getState().state.counters.playSeconds).toBeCloseTo(1, 1);
    store.getState().shutdown();
  });

  it('survives React StrictMode: boot, shutdown, boot', () => {
    const { store, storage } = setup();
    store.getState().boot();
    store.getState().shutdown();
    expect(storage.data.has(SAVE_KEY)).toBe(true);
    store.getState().boot();
    vi.advanceTimersByTime(1000);
    expect(store.getState().ready).toBe(true);
    expect(store.getState().state.counters.playSeconds).toBeCloseTo(1, 1);
    store.getState().shutdown();
    vi.advanceTimersByTime(5000);
    expect(store.getState().state.counters.playSeconds).toBeCloseTo(1, 1); // the loop is stopped
  });

  it('loads an existing save', () => {
    const { store } = setup((state) => {
      state.coins = new Decimal(777);
      state.levels = { cafe: 3 };
    });
    store.getState().boot();
    expect(store.getState().state.coins.toNumber()).toBeCloseTo(777);
    expect(store.getState().state.levels['cafe']).toBe(3);
    store.getState().shutdown();
  });

  it('starts fresh when the save is corrupt or storage fails', () => {
    const storage = memoryStorage();
    storage.data.set(SAVE_KEY, '{not json');
    const { store } = setup(undefined, storage);
    store.getState().boot();
    expect(store.getState().ready).toBe(true);
    expect(store.getState().state.coins.toNumber()).toBe(0);
    store.getState().shutdown();

    const broken: StorageLike = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('full');
      },
      removeItem() {
        throw new Error('blocked');
      },
    };
    const second = setup(undefined, broken as MemoryStorage);
    expect(() => second.store.getState().boot()).not.toThrow();
    expect(() => second.store.getState().save()).not.toThrow();
    expect(() => second.store.getState().hardReset()).not.toThrow();
    second.store.getState().shutdown();
  });

  it('works with no browser at all (no window, no document)', () => {
    expect(typeof window).toBe('undefined');
    const { store } = setup();
    expect(() => store.getState().boot()).not.toThrow();
    store.getState().shutdown();
  });
});

describe('the loop', () => {
  it('advances production by real elapsed time', () => {
    const { store } = setup((state) => {
      state.levels = { cafe: 10 }; // 30/s
    });
    store.getState().boot();
    vi.advanceTimersByTime(10_000);
    expect(store.getState().state.coins.toNumber()).toBeCloseTo(300, 0);
    store.getState().shutdown();
  });

  it('publishes a new state reference each tick, sharing what did not change', () => {
    const { store } = setup();
    store.getState().boot();
    const before = store.getState().state;
    vi.advanceTimersByTime(100);
    const after = store.getState().state;
    expect(after).not.toBe(before);
    expect(after.lastTickAt).toBeGreaterThan(before.lastTickAt);
    expect(after.levels).toBe(before.levels);
    expect(after.hired).toBe(before.hired);
    expect(after.counters).not.toBe(before.counters); // playSeconds moved
    store.getState().shutdown();
  });

  it('delivers events only after the new state is published', () => {
    const coinsSeenByListener: number[] = [];
    const store = createGameStore({
      content: createFixtureContent(),
      storage: () => memoryStorage(),
      emit: (event) => {
        if (event.type === 'click') coinsSeenByListener.push(store.getState().state.coins.toNumber());
      },
    });
    store.getState().click();
    expect(coinsSeenByListener).toEqual([1]);
  });

  it('settles a gap of many minutes as offline earnings instead of paying it in full', () => {
    const { store } = setup((state) => {
      state.hired.gladimir = true;
      state.levels = { cafe: 10 };
    });
    store.getState().boot();
    vi.setSystemTime(Date.now() + 10 * 3_600_000); // the machine slept for 10 hours
    vi.advanceTimersByTime(100);
    const report = store.getState().offlineReport;
    expect(report).not.toBeNull();
    expect(report!.countedMs).toBe(2 * 3_600_000);
    expect(store.getState().state.coins.toNumber()).toBeCloseTo(30 * 7200 * 0.5, -1);
    store.getState().shutdown();
  });

  it('pays nothing for a long sleep without the offline feature', () => {
    const { store } = setup((state) => {
      state.levels = { cafe: 10 };
    });
    store.getState().boot();
    vi.setSystemTime(Date.now() + 10 * 3_600_000);
    vi.advanceTimersByTime(100);
    expect(store.getState().state.coins.toNumber()).toBeLessThan(10);
    store.getState().shutdown();
  });
});

describe('offline earnings on boot', () => {
  it('reports what was earned while away and lets the UI dismiss it', () => {
    const { store, events } = setup((state) => {
      state.hired.gladimir = true;
      state.levels = { cafe: 10 };
      state.lastTickAt = Date.now() - 3_600_000;
    });
    store.getState().boot();
    const report = store.getState().offlineReport;
    expect(report).not.toBeNull();
    expect(report!.coins.toNumber()).toBeCloseTo(30 * 3600 * 0.5, 1);
    expect(events.map((e) => e.type)).toEqual(expect.arrayContaining(['loaded', 'offline']));
    store.getState().dismissOffline();
    expect(store.getState().offlineReport).toBeNull();
    store.getState().shutdown();
  });

  it('has no report after a short absence', () => {
    const { store } = setup((state) => {
      state.hired.gladimir = true;
      state.levels = { cafe: 10 };
      state.lastTickAt = Date.now() - 20_000;
    });
    store.getState().boot();
    expect(store.getState().offlineReport).toBeNull();
    expect(store.getState().state.coins.toNumber()).toBeCloseTo(30 * 20, 0); // paid by the tick, in full
    store.getState().shutdown();
  });
});

describe('actions', () => {
  it('click pays and emits', () => {
    const { store, events } = setup();
    store.getState().boot();
    store.getState().click(5, 6);
    expect(store.getState().state.coins.toNumber()).toBe(1);
    expect(events.find((e) => e.type === 'click')).toMatchObject({ x: 5, y: 6, auto: false });
    store.getState().shutdown();
  });

  it('purchases return booleans and a failed one publishes nothing', () => {
    const { store } = setup((state) => {
      state.coins = new Decimal(30);
    });
    store.getState().boot();
    const before = store.getState().state;
    expect(store.getState().buyDiscipline('programacao')).toBe(false);
    expect(store.getState().state).toBe(before);
    expect(store.getState().buyDiscipline('cafe')).toBe(true);
    expect(store.getState().state.levels['cafe']).toBe(1);
    expect(store.getState().state.levels).not.toBe(before.levels);
    expect(store.getState().buyClickUpgrade('joinha')).toBe(true);
    expect(store.getState().buyResearch('r-clickpower')).toBe(false);
    expect(store.getState().hireProfessor('gladimir')).toBe(false);
    store.getState().shutdown();
  });

  it('hires, switches professor, equips cosmetics, uses abilities, graduates', () => {
    const { store } = setup((state) => {
      state.coins = new Decimal(1000);
      state.hired.gladimir = true;
      state.hired.b2 = true;
      state.hired.guto = true;
      state.hired.angelo = true;
      state.runCoins = new Decimal(1e6);
      state.skins['edecio-cafe'] = true;
    });
    store.getState().boot();
    const api = store.getState();
    api.setActiveProfessor('gladimir');
    expect(store.getState().state.activeProfessor).toBe('gladimir');
    api.setBuyAmount(10);
    expect(store.getState().state.buyAmount).toBe(10);
    api.equipSkin('edecio-cafe');
    expect(store.getState().state.equippedSkin.edecio).toBe('edecio-cafe');
    expect(api.useAbility('auto-scaling')).toBe(true);
    expect(store.getState().state.buffs).toHaveLength(1);
    expect(api.graduate()).toBe(true);
    expect(store.getState().state.diplomas).toBeGreaterThan(0);
    expect(store.getState().state.hired.gladimir).toBe(false);
    expect(api.buyPrestigeNode('core-power')).toBe(true);
    store.getState().shutdown();
  });

  it('unlocks secret achievements by trigger', () => {
    const content = createFixtureContent();
    const storage = memoryStorage();
    const store = createGameStore({ content, storage: () => storage });
    store.getState().boot();
    store.getState().triggerSecret('konami');
    expect(store.getState().state.secrets['konami']).toBe(true);
    expect(store.getState().state.achievements['a-secret']).toBeDefined();
    store.getState().shutdown();
  });

  it('clamps volumes when updating settings', () => {
    const { store } = setup();
    store.getState().boot();
    store.getState().updateSettings({ sfxVolume: 4, musicVolume: -2, muted: true });
    expect(store.getState().state.settings).toMatchObject({ sfxVolume: 1, musicVolume: 0, muted: true });
    store.getState().shutdown();
  });
});

describe('saving', () => {
  it('autosaves every 15 seconds', () => {
    const { store, storage } = setup();
    store.getState().boot();
    expect(storage.writes).toBe(0);
    vi.advanceTimersByTime(AUTOSAVE_MS - 100);
    expect(storage.writes).toBe(0);
    vi.advanceTimersByTime(200);
    expect(storage.writes).toBe(1);
    vi.advanceTimersByTime(AUTOSAVE_MS);
    expect(storage.writes).toBe(2);
    store.getState().shutdown();
  });

  it('saves shortly after a purchase, debounced', () => {
    const { store, storage } = setup((state) => {
      state.coins = new Decimal(1000);
    });
    store.getState().boot();
    store.getState().buyDiscipline('cafe');
    store.getState().buyDiscipline('cafe');
    expect(storage.writes).toBe(0);
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS + 10);
    expect(storage.writes).toBe(1);
    const saved = JSON.parse(storage.data.get(SAVE_KEY) ?? '{}');
    expect(saved.levels.cafe).toBe(2);
    store.getState().shutdown();
  });

  it('saves on shutdown and tells the UI', () => {
    const { store, storage, events } = setup();
    store.getState().boot();
    store.getState().shutdown();
    expect(storage.writes).toBe(1);
    expect(events.some((e) => e.type === 'saved')).toBe(true);
  });

  it('saves when the page is hidden or unloading', () => {
    const target = new EventTarget();
    const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
    vi.stubGlobal('window', target);
    vi.stubGlobal('document', doc);
    try {
      const { store, storage } = setup();
      store.getState().boot();
      target.dispatchEvent(new Event('beforeunload'));
      expect(storage.writes).toBe(1);
      doc.visibilityState = 'hidden';
      doc.dispatchEvent(new Event('visibilitychange'));
      expect(storage.writes).toBe(2);
      store.getState().shutdown();
      const writes = storage.writes;
      target.dispatchEvent(new Event('beforeunload')); // listeners are detached
      expect(storage.writes).toBe(writes);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('round-trips through export and import, and refuses garbage', () => {
    const { store } = setup((state) => {
      state.coins = new Decimal(500);
      state.levels = { cafe: 4 };
    });
    store.getState().boot();
    const text = store.getState().exportSave();
    store.getState().hardReset();
    expect(store.getState().state.levels).toEqual({});
    expect(store.getState().importSave(text)).toBe(true);
    expect(store.getState().state.levels['cafe']).toBe(4);
    expect(store.getState().state.coins.toNumber()).toBeCloseTo(500);

    const before = store.getState().state;
    expect(store.getState().importSave('definitely not a save')).toBe(false);
    expect(store.getState().state).toBe(before);
    store.getState().shutdown();
  });

  it('serializes the raw save JSON, which importSave accepts back', () => {
    const { store } = setup((state) => {
      state.levels = { cafe: 7 };
    });
    store.getState().boot();
    const json = store.getState().serialize();
    expect(JSON.parse(json).levels.cafe).toBe(7);
    store.getState().hardReset();
    expect(store.getState().importSave(json)).toBe(true);
    expect(store.getState().state.levels['cafe']).toBe(7);
    store.getState().shutdown();
  });

  it('does not pay offline earnings for an imported save', () => {
    const { store } = setup((state) => {
      state.hired.gladimir = true;
      state.levels = { cafe: 10 };
    });
    store.getState().boot();
    const text = store.getState().exportSave();
    vi.advanceTimersByTime(60_000);
    const oldSave = JSON.parse(atob(text));
    oldSave.lastTickAt = Date.now() - 5 * 3_600_000;
    expect(store.getState().importSave(btoa(JSON.stringify(oldSave)))).toBe(true);
    expect(store.getState().offlineReport).toBeNull();
    expect(store.getState().state.lastTickAt).toBe(Date.now());
    store.getState().shutdown();
  });

  it('hard reset wipes the game and the stored save', () => {
    const { store, storage, events } = setup((state) => {
      state.coins = new Decimal(500);
      state.diplomas = 9;
    });
    store.getState().boot();
    store.getState().hardReset();
    expect(store.getState().state.coins.toNumber()).toBe(0);
    expect(store.getState().state.diplomas).toBe(0);
    expect(JSON.parse(storage.data.get(SAVE_KEY) ?? '{}').diplomas).toBe(0);
    expect(events.some((e) => e.type === 'reset')).toBe(true);
    store.getState().shutdown();
  });
});

describe('global event bus', () => {
  it('feeds subscribeGameEvents by default', () => {
    const received: GameEvent[] = [];
    subscribeGameEvents((event) => received.push(event));
    const store = createGameStore({ content: createFixtureContent(), storage: () => memoryStorage() });
    store.getState().boot();
    store.getState().click();
    store.getState().shutdown();
    expect(received.map((e) => e.type)).toEqual(expect.arrayContaining(['click', 'saved']));
  });
});
