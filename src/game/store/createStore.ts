import { MAX_DEV_MULTIPLIER, MIN_DEV_MULTIPLIER } from '../engine/state';
import { create } from 'zustand';
import type { StoreApi, UseBoundStore } from 'zustand';
import type { GameContent } from '../content/types';
import * as engine from '../engine/actions';
import { createInitialState } from '../engine/init';
import { applyOffline } from '../engine/offline';
import { deserializeState, importSave as importSaveData, exportSave as exportSaveData, serializeState } from '../engine/save';
import type { GameState } from '../engine/state';
import { advance } from '../engine/tick';
import { emitGameEvent } from './bus';
import { cloneState, publishState } from './share';
import type { Emit, GameEvent, GameStore } from './types';

export const SAVE_KEY = 'adsclicker.save';
/** Where a save that failed to load is kept, so it can still be recovered by hand. */
export const UNREADABLE_SAVE_KEY = 'adsclicker.save.unreadable';

export const TICK_MS = 100;
export const AUTOSAVE_MS = 15_000;
export const SAVE_DEBOUNCE_MS = 1_000;
/**
 * A single tick gap longer than this means the tab was frozen or the machine slept, so the time is
 * settled as offline earnings (capped, partial rate) instead of paid in full by the tick.
 */
export const SLEEP_GAP_MS = 5 * 60_000;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StoreDeps {
  content: GameContent;
  /** Clock in epoch ms. Default: Date.now. */
  now?: () => number;
  /** Randomness in [0, 1). Default: Math.random. */
  rng?: () => number;
  /** Resolved lazily at boot so importing the module never touches the browser. Default: localStorage. */
  storage?: () => StorageLike | null;
  /** Where events go after the new state is published. Default: the global event bus. */
  emit?: Emit;
}

function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // blocked by privacy settings
  }
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Builds the game store. The engine mutates a private working state; after each mutation the store
 * publishes an immutable copy (new top-level reference, structural sharing below it) as `state`.
 */
export function createGameStore(deps: StoreDeps): UseBoundStore<StoreApi<GameStore>> {
  const { content } = deps;
  const now = deps.now ?? (() => Date.now());
  const rng = deps.rng ?? (() => Math.random());
  const getStorage = deps.storage ?? browserStorage;
  const emitEvent = deps.emit ?? emitGameEvent;

  let working: GameState = createInitialState(content, 0);
  let running = false;
  let loopTimer: ReturnType<typeof setInterval> | null = null;
  let autosaveTimer: ReturnType<typeof setInterval> | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let detachBrowser: (() => void) | null = null;

  return create<GameStore>()((set, get) => {
    function publish(): void {
      set({ state: publishState(get().state, working) });
    }

    function flush(events: GameEvent[]): void {
      for (const event of events) emitEvent(event);
    }

    /** Runs an engine call on the working state, publishes, then delivers the events. */
    function run<T>(fn: (state: GameState, emit: Emit) => T, saveSoon = false): T {
      const events: GameEvent[] = [];
      const result = fn(working, (event) => events.push(event));
      if (result !== false) {
        publish();
        flush(events);
        if (saveSoon) scheduleSave();
      }
      return result;
    }

    function writeSave(): void {
      try {
        getStorage()?.setItem(SAVE_KEY, serializeState(working));
      } catch {
        // Storage full or blocked: keep playing, the next autosave tries again.
      }
    }

    function scheduleSave(): void {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        saveTimer = null;
        get().save();
      }, SAVE_DEBOUNCE_MS);
    }

    function loadSaved(at: number): GameState | null {
      try {
        const storage = getStorage();
        const text = storage?.getItem(SAVE_KEY);
        if (!text) return null;
        const loaded = deserializeState(text, content, at);
        // A save that cannot be read is set aside, so the fresh game that replaces it does not erase it.
        if (!loaded) storage?.setItem(UNREADABLE_SAVE_KEY, text);
        return loaded;
      } catch {
        return null;
      }
    }

    function tick(): void {
      const at = now();
      const events: GameEvent[] = [];
      const emit: Emit = (event) => events.push(event);
      const sleepGap = Math.max(SLEEP_GAP_MS, content.balance.offline.minAwayMs);
      const report = at - working.lastTickAt > sleepGap ? applyOffline(working, content, at, emit) : null;
      advance(working, content, at, rng, emit);
      publish();
      if (report) set({ offlineReport: report });
      flush(events);
    }

    function attachBrowserListeners(): void {
      if (typeof window === 'undefined' || typeof document === 'undefined') return;
      const onHidden = () => {
        if (document.visibilityState === 'hidden') get().save();
        else tick();
      };
      const onUnload = () => get().save();
      window.addEventListener('beforeunload', onUnload);
      window.addEventListener('pagehide', onUnload);
      document.addEventListener('visibilitychange', onHidden);
      detachBrowser = () => {
        window.removeEventListener('beforeunload', onUnload);
        window.removeEventListener('pagehide', onUnload);
        document.removeEventListener('visibilitychange', onHidden);
      };
    }

    function stopTimers(): void {
      if (loopTimer) clearInterval(loopTimer);
      if (autosaveTimer) clearInterval(autosaveTimer);
      if (saveTimer) clearTimeout(saveTimer);
      loopTimer = autosaveTimer = saveTimer = null;
      detachBrowser?.();
      detachBrowser = null;
    }

    return {
      state: cloneState(working),
      ready: false,
      offlineReport: null,

      boot() {
        if (running) return;
        running = true;

        if (!get().ready) {
          const at = now();
          const events: GameEvent[] = [];
          const emit: Emit = (event) => events.push(event);
          const loaded = loadSaved(at);
          working = loaded ?? createInitialState(content, at);
          if (loaded) events.push({ type: 'loaded' });
          const report = applyOffline(working, content, at, emit);
          advance(working, content, at, rng, emit);
          set({ state: publishState(get().state, working), ready: true, offlineReport: report });
          flush(events);
        }

        attachBrowserListeners();
        loopTimer = setInterval(tick, TICK_MS);
        autosaveTimer = setInterval(() => get().save(), AUTOSAVE_MS);
      },

      shutdown() {
        if (!running) return;
        running = false;
        stopTimers();
        get().save();
      },

      click(x, y) {
        run((state, emit) => engine.click(state, content, now(), rng, emit, { x, y }));
      },

      setBuyAmount(amount) {
        run((state) => engine.setBuyAmount(state, content, amount), true);
      },
      buyDiscipline: (id) => run((state, emit) => engine.buyDiscipline(state, content, id, now(), emit), true),
      buyClickUpgrade: (id) => run((state, emit) => engine.buyClickUpgrade(state, content, id, now(), emit), true),
      buyResearch: (id) => run((state, emit) => engine.buyResearch(state, content, id, now(), emit), true),
      hireProfessor: (id) => run((state, emit) => engine.hireProfessor(state, content, id, now(), emit), true),
      setActiveProfessor(id) {
        run((state, emit) => engine.setActiveProfessor(state, content, id, now(), emit), true);
      },

      equipSkin(id) {
        run((state) => engine.equipSkin(state, content, id), true);
      },
      equipScenery(id) {
        run((state) => engine.equipScenery(state, content, id), true);
      },
      equipTheme(id) {
        run((state) => engine.equipTheme(state, content, id), true);
      },

      hitInvasion() {
        run((state, emit) => engine.hitInvasion(state, content, now(), rng, emit));
      },
      useAbility: (id) => run((state, emit) => engine.activateAbility(state, content, id, now(), emit), true),
      acceptSprint: (defId) => run((state, emit) => engine.acceptSprint(state, content, defId, now(), emit), true),

      graduate() {
        const done = run((state, emit) => engine.graduate(state, content, now(), emit));
        if (done) get().save();
        return done;
      },
      buyPrestigeNode: (id) => run((state, emit) => engine.buyPrestigeNode(state, content, id, now(), emit), true),

      triggerSecret(trigger) {
        run((state, emit) => engine.triggerSecret(state, content, trigger, now(), emit), true);
      },

      updateSettings(patch) {
        run((state) => {
          const next = { ...state.settings, ...patch };
          next.sfxVolume = clamp01(next.sfxVolume);
          next.musicVolume = clamp01(next.musicVolume);
          next.devMultiplier = Number.isFinite(next.devMultiplier)
            ? Math.min(MAX_DEV_MULTIPLIER, Math.max(MIN_DEV_MULTIPLIER, next.devMultiplier))
            : 1;
          state.settings = next;
        }, true);
      },

      save() {
        working.lastSavedAt = now();
        writeSave();
        publish();
        emitEvent({ type: 'saved' });
      },

      serialize: () => serializeState(working),

      exportSave: () => exportSaveData(working),

      importSave(data) {
        const at = now();
        const imported = importSaveData(data, content, at);
        if (!imported) return false;
        imported.lastTickAt = at; // an import is not a return from being away
        working = imported;
        publish();
        set({ offlineReport: null });
        emitEvent({ type: 'loaded' });
        get().save();
        return true;
      },

      hardReset() {
        const at = now();
        working = createInitialState(content, at);
        try {
          getStorage()?.removeItem(SAVE_KEY);
        } catch {
          // nothing to clear
        }
        publish();
        set({ offlineReport: null });
        emitEvent({ type: 'reset' });
        get().save();
      },

      dismissOffline() {
        set({ offlineReport: null });
      },
    };
  });
}
