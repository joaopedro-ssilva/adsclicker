import { create } from 'zustand';
import type { StoreApi, UseBoundStore } from 'zustand';
import { z } from 'zod';
import { SYNC_INTERVAL_MS, saveSummarySchema } from '@/shared/api';
import type { ApiError, CloudSave, Me, SaveSummary } from '@/shared/api';
import type { ApiResult, api as realApi } from '@/shared/apiClient';
import type { StorageLike } from '../store/createStore';
import type { GameEvent } from '../store/types';
import { isFreshDevice, sameProgress } from './summary';
import type { ActionResult, CloudStore } from './types';

/** Where the cloud revision this device last saw lives, next to the save. */
export const CLOUD_KEY = 'adsclicker.cloud';

/** Wait before a sync that follows a graduation or a hire, so a burst of events becomes one request. */
export const EVENT_DELAY_MS = 800;
/** Closest two background syncs may be (the server allows 6 per minute). */
export const MIN_GAP_MS = 8_000;
export const BACKOFF_BASE_MS = 10_000;
export const BACKOFF_MAX_MS = 5 * 60_000;
/** A deployment without a database is asked again this rarely, so it stays quiet. */
export const UNAVAILABLE_RETRY_MS = 5 * 60_000;
export const RATE_LIMIT_RETRY_MS = 60_000;

type Api = Pick<typeof realApi, 'me' | 'sync' | 'login' | 'logout' | 'setNickname' | 'setPassword'>;

/** What the cloud needs from the game, so it can be tested without one. */
export interface CloudGame {
  serialize(): string;
  /** Replaces the local progress. Returns false when the text is not a usable save. */
  adopt(serialized: string): boolean;
  summary(): SaveSummary;
  multiplier(): number;
  setMultiplier(value: number): void;
  subscribe(listener: (event: GameEvent) => void): () => void;
}

export interface CloudEnv {
  visible(): boolean;
  onVisibility(listener: (visible: boolean) => void): () => void;
  onPageHide(listener: () => void): () => void;
}

export interface CloudDeps {
  api: Api;
  game: CloudGame;
  env: CloudEnv;
  storage: () => StorageLike | null;
  now: () => number;
  timers: {
    set: (fn: () => void, ms: number) => unknown;
    clear: (handle: unknown) => void;
  };
}

type Failure = 'network' | 'unavailable' | 'limited' | 'failed';

function classify(status: number, error: ApiError['error']): Failure {
  if (status === 0) return 'network';
  if (error.code === 'unavailable' || status === 404) return 'unavailable';
  if (error.code === 'rate_limited') return 'limited';
  return 'failed';
}

/** Requests remembered at most this many at a time (the previous page's and this one's). */
const MAX_PENDING = 3;

/** A request that left without an answer being recorded (the page may have closed meanwhile). */
interface PendingSync {
  baseRev: number;
  summary: SaveSummary;
}

interface Persisted {
  rev: number;
  /** A reset is waiting to overwrite the cloud. */
  force: boolean;
  pending?: PendingSync[];
}

const pendingSchema = z.object({ baseRev: z.number().int().min(0), summary: saveSummarySchema });

function readPending(value: unknown): PendingSync[] {
  const parsed = z.array(pendingSchema).safeParse(value);
  return parsed.success ? parsed.data.slice(-MAX_PENDING) : [];
}

function readPersisted(storage: StorageLike | null): Persisted {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(CLOUD_KEY) ?? 'null');
    if (typeof parsed === 'object' && parsed !== null && 'rev' in parsed) {
      const { rev } = parsed;
      const force = 'force' in parsed && parsed.force === true;
      const pending = 'pending' in parsed ? readPending(parsed.pending) : [];
      if (typeof rev === 'number' && Number.isInteger(rev) && rev >= 0) return { rev, force, pending };
    }
  } catch {
    // unreadable: start from "never synced"
  }
  return { rev: 0, force: false, pending: [] };
}

/**
 * True when the cloud save looks like the request this device sent and never heard back about
 * (a sync on pagehide lands on the server after the page is gone, so the revision was never stored).
 * Without this, every reload shortly after a sync would ask the player to choose against themselves.
 */
function isOwnWrite(pending: readonly PendingSync[], cloud: CloudSave): boolean {
  const b = cloud.summary;
  return pending.some(
    ({ baseRev, summary: a }) =>
      cloud.rev === baseRev + 1 &&
      a.playSeconds === b.playSeconds &&
      a.diplomasEarned === b.diplomasEarned &&
      a.professors === b.professors &&
      a.achievements === b.achievements,
  );
}

/**
 * The cloud client. Everything is injected (api, game, clock, storage, timers) so the policy can be
 * tested without a browser. Nothing here runs inside the game loop: the game only ever calls
 * serialize() and updateSettings() on it, both cheap and synchronous.
 *
 * Sync policy: one request at a time; a timer every SYNC_INTERVAL_MS while the tab is visible; a
 * flush when the tab is hidden or the page is left; a short-delay sync after a graduation or a hire.
 * Failures back off exponentially (capped), "unavailable" is retried every few minutes only.
 */
export function createCloudStore(deps: CloudDeps): UseBoundStore<StoreApi<CloudStore>> {
  const { api, game, env, now, timers } = deps;

  let started = false;
  let rev = 0;
  /** After a hard reset the next sync overwrites the cloud instead of asking. */
  let forceNext = false;
  let pending: PendingSync[] = [];
  let bootstrapped = false;
  let inflight: Promise<void> | null = null;
  let locked = false;
  let failures = 0;
  let lastAttemptAt = 0;
  let regularDueAt = 0;
  let eventDueAt: number | null = null;
  let blockedUntil = 0;
  let timer: unknown = null;
  let visible = true;
  /** Bumped whenever the local save is replaced, so a response about the old save is dropped. */
  let generation = 0;
  let adopting = false;
  let unsubscribe: (() => void)[] = [];

  return create<CloudStore>()((set, get) => {
    const persist = () => {
      try {
        deps.storage()?.setItem(CLOUD_KEY, JSON.stringify({ rev, force: forceNext, pending: pending.length > 0 ? pending : undefined } satisfies Persisted));
      } catch {
        // storage blocked: the revision then lives for this session only
      }
    };

    const applyMultiplier = (value: number) => {
      if (get().multiplier !== value) set({ multiplier: value });
      if (game.multiplier() !== value) game.setMultiplier(value);
    };

    const adoptCloud = (cloud: CloudSave): boolean => {
      adopting = true;
      let adopted = false;
      try {
        adopted = game.adopt(cloud.save);
      } finally {
        adopting = false;
      }
      if (!adopted) return false;
      generation += 1;
      pending = [];
      rev = cloud.rev;
      forceNext = false;
      persist();
      // The adopted save carries the multiplier of the device that wrote it; the server's is the truth.
      applyMultiplier(get().multiplier);
      set({ conflict: null, status: 'synced', lastSyncedAt: cloud.savedAt });
      return true;
    };

    // ----- scheduling -------------------------------------------------------

    const plan = () => {
      if (timer !== null) timers.clear(timer);
      timer = null;
      if (!started || locked || !visible || get().status === 'conflict') return;
      const at = Math.max(blockedUntil, Math.min(regularDueAt, eventDueAt ?? Infinity));
      timer = timers.set(() => {
        timer = null;
        void request(false);
      }, Math.max(0, at - now()));
    };

    const syncSoon = () => {
      if (!started) return;
      const earliest = Math.max(now() + EVENT_DELAY_MS, lastAttemptAt + MIN_GAP_MS);
      eventDueAt = Math.min(eventDueAt ?? Infinity, earliest);
      plan();
    };

    const afterAttempt = (delay: number, failure: boolean) => {
      regularDueAt = now() + delay;
      blockedUntil = failure ? regularDueAt : 0;
    };

    // ----- the sync cycle ---------------------------------------------------

    const fail = (failure: Failure, previous: CloudStore['status']) => {
      if (failure === 'limited') {
        // Asked too often: wait, but do not alarm the player.
        afterAttempt(RATE_LIMIT_RETRY_MS, true);
        set({ status: previous === 'syncing' ? 'idle' : previous });
        return;
      }
      failures += 1;
      const delay =
        failure === 'unavailable'
          ? UNAVAILABLE_RETRY_MS
          : Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** (failures - 1));
      afterAttempt(delay, true);
      set({ status: 'offline', unavailable: failure === 'unavailable' });
    };

    const cycle = async (keepalive: boolean): Promise<void> => {
      const previous = get().status;
      set({ status: 'syncing' });
      eventDueAt = null; // events that arrive while this request is out schedule the next one
      const startedGeneration = generation;
      lastAttemptAt = now();

      if (!bootstrapped) {
        const me = await api.me();
        if (!started) return;
        if (!me.ok) return fail(classify(me.status, me.error), previous);
        bootstrapped = true;
        set({ me: me.data.me, unavailable: false });
        applyMultiplier(me.data.multiplier);
      }

      const forced = forceNext;
      // Kept next to older unanswered ones: the previous page's request may be the one that landed.
      pending = [...pending, { baseRev: rev, summary: game.summary() }].slice(-MAX_PENDING);
      persist();
      const result = await api.sync({ save: game.serialize(), baseRev: rev, force: forced || undefined }, { keepalive });
      if (!started) return;
      if (generation !== startedGeneration) {
        // The save was replaced while the request was out: its answer is about a save that is gone.
        set({ status: previous === 'syncing' ? 'idle' : previous });
        regularDueAt = now();
        return;
      }
      if (!result.ok) {
        // A refusal means nothing was written; only a lost connection leaves the outcome unknown.
        if (result.status !== 0) pending = [];
        persist();
        return fail(classify(result.status, result.error), previous);
      }

      failures = 0;
      afterAttempt(SYNC_INTERVAL_MS, false);
      const { data } = result;
      applyMultiplier(data.multiplier);
      if (data.status === 'conflict' && isOwnWrite(pending, data.cloud)) {
        // Our own earlier request landed after the page closed: take its revision and send what is new.
        rev = data.cloud.rev;
        pending = [];
        persist();
        set({ status: 'synced', me: data.me, lastSyncedAt: data.cloud.savedAt, unavailable: false });
        syncSoon();
        return;
      }
      pending = [];
      if (data.status === 'conflict') {
        persist();
        set({ status: 'conflict', me: data.me, conflict: { cloud: data.cloud, origin: 'sync' }, unavailable: false });
        return;
      }
      rev = data.rev;
      if (forced) forceNext = false;
      persist();
      set({ status: 'synced', me: data.me, lastSyncedAt: now(), unavailable: false });
    };

    /** The only way a sync starts. Never more than one in flight; a request meanwhile is folded into one follow-up. */
    function request(keepalive: boolean): Promise<void> {
      if (inflight) {
        syncSoon();
        return inflight;
      }
      if (!started || locked || get().status === 'conflict') return Promise.resolve();
      inflight = cycle(keepalive)
        .catch(() => fail('failed', get().status))
        .finally(() => {
          inflight = null;
          plan();
        });
      return inflight;
    }

    /** For account actions: waits for a running sync and keeps new ones off until the action ends. */
    const exclusive = async <T>(action: () => Promise<T>): Promise<T> => {
      if (inflight) await inflight.catch(() => undefined);
      locked = true;
      plan();
      try {
        return await action();
      } finally {
        locked = false;
        plan();
      }
    };

    const flush = () => {
      if (!started || now() < blockedUntil) return;
      void request(true);
    };

    // ----- game events ------------------------------------------------------

    const onGameEvent = (event: GameEvent) => {
      if (event.type === 'graduate' || event.type === 'hire') {
        syncSoon();
      } else if (event.type === 'reset') {
        generation += 1;
        rev = 0;
        pending = [];
        forceNext = true;
        persist();
        if (get().conflict) set({ conflict: null, status: 'idle' });
        syncSoon();
      } else if (event.type === 'loaded' && !adopting) {
        // A manual import: this is a different save from the one the revision belongs to.
        generation += 1;
        rev = 0;
        pending = [];
        forceNext = false;
        persist();
        if (get().conflict) set({ conflict: null, status: 'idle' });
        syncSoon();
      }
    };

    const failed = (error: ApiError['error']): ActionResult => ({ ok: false, error });
    const noSession: ApiError['error'] = { code: 'unavailable', message: 'Sem conexão com o servidor.' };

    /** Account calls need a session; the first sync creates the guest, so make sure it ran. */
    const ensureSession = async (): Promise<boolean> => {
      if (get().me) return true;
      await request(false);
      return get().me !== null;
    };

    const accountCall = async (call: () => Promise<ApiResult<{ me: Me }>>): Promise<ActionResult> => {
      if (get().status === 'conflict') {
        return failed({ code: 'forbidden', message: 'Resolva primeiro qual progresso manter.' });
      }
      if (!(await ensureSession())) return failed(noSession);
      const result = await exclusive(call);
      if (!result.ok) return failed(result.error);
      set({ me: result.data.me });
      syncSoon();
      return { ok: true };
    };

    return {
      status: 'idle',
      me: null,
      lastSyncedAt: null,
      multiplier: 1,
      conflict: null,
      unavailable: false,

      start() {
        if (started) return;
        started = true;
        const saved = readPersisted(deps.storage());
        rev = saved.rev;
        forceNext = saved.force;
        pending = saved.pending ?? [];
        visible = env.visible();
        // A multiplier left in the save is not trusted: the server's value arrives with the first answer.
        applyMultiplier(1);

        unsubscribe = [
          game.subscribe(onGameEvent),
          env.onVisibility((nowVisible) => {
            visible = nowVisible;
            if (nowVisible) plan();
            else {
              plan();
              flush();
            }
          }),
          env.onPageHide(flush),
        ];
        regularDueAt = now();
        void request(false);
      },

      stop() {
        started = false;
        if (timer !== null) timers.clear(timer);
        timer = null;
        unsubscribe.forEach((off) => off());
        unsubscribe = [];
        bootstrapped = false;
      },

      syncNow() {
        blockedUntil = 0;
        return request(false);
      },

      useCloudSave() {
        const conflict = get().conflict;
        if (!conflict) return;
        if (adoptCloud(conflict.cloud)) syncSoon();
      },

      async keepLocalSave() {
        const conflict = get().conflict;
        if (!conflict) return;
        const result = await exclusive(() =>
          api.sync({ save: game.serialize(), baseRev: conflict.cloud.rev, force: true }),
        );
        if (!result.ok || result.data.status !== 'ok') return; // the dialog stays so the player can try again
        failures = 0;
        rev = result.data.rev;
        forceNext = false;
        persist();
        afterAttempt(SYNC_INTERVAL_MS, false);
        applyMultiplier(result.data.multiplier);
        set({ conflict: null, status: 'synced', me: result.data.me, lastSyncedAt: now() });
        plan();
      },

      setNickname: (nickname) => accountCall(() => api.setNickname({ nickname })),

      setPassword: (password, currentPassword) =>
        accountCall(() => api.setPassword({ password, currentPassword: currentPassword || undefined })),

      async login(nickname, password) {
        if (get().status === 'conflict') {
          return failed({ code: 'forbidden', message: 'Resolva primeiro qual progresso manter.' });
        }
        const result = await exclusive(() => api.login({ nickname, password }));
        if (!result.ok) return failed(result.error);
        const { me, multiplier, cloud } = result.data;
        set({ me, unavailable: false });
        applyMultiplier(multiplier);
        bootstrapped = true;

        if (!cloud) {
          rev = 0;
          persist();
          syncSoon();
          return { ok: true };
        }
        const local = game.summary();
        if (isFreshDevice(local)) {
          if (!adoptCloud(cloud)) return failed({ code: 'internal', message: 'O progresso da conta não pôde ser lido.' });
        } else if (sameProgress(local, cloud.summary)) {
          rev = cloud.rev;
          forceNext = false;
          persist();
          set({ status: 'synced', lastSyncedAt: cloud.savedAt });
        } else {
          set({ status: 'conflict', conflict: { cloud, origin: 'login' } });
          plan();
          return { ok: true };
        }
        syncSoon();
        return { ok: true };
      },

      async logout() {
        const result = await exclusive(() => api.logout());
        if (!result.ok) return;
        // The local save stays; the next sync makes it a new guest, which has no cloud revision.
        generation += 1;
        rev = 0;
        pending = [];
        forceNext = false;
        bootstrapped = true;
        persist();
        applyMultiplier(1);
        set({ me: null, conflict: null, status: 'idle', lastSyncedAt: null });
        syncSoon();
      },
    };
  });
}
