import { describe, expect, it } from 'vitest';
import { SYNC_INTERVAL_MS } from '@/shared/api';
import type { CloudSave, Me, SaveSummary, SyncResponse } from '@/shared/api';
import type { ApiResult } from '@/shared/apiClient';
import type { StorageLike } from '../store/createStore';
import type { GameEvent } from '../store/types';
import {
  BACKOFF_BASE_MS,
  BACKOFF_MAX_MS,
  CLOUD_KEY,
  EVENT_DELAY_MS,
  UNAVAILABLE_RETRY_MS,
  createCloudStore,
} from './createCloud';
import type { CloudDeps, CloudEnv } from './createCloud';

const T0 = 1_700_000_000_000;

const guest: Me = { id: 'p1', nickname: null, hasPassword: false, ranked: false, unrankedReason: 'Sem apelido.' };
const summary = (patch: Partial<SaveSummary> = {}): SaveSummary => ({
  lifetimeCoins: '1000',
  diplomasEarned: 0,
  professors: 1,
  achievements: 2,
  playSeconds: 600,
  ...patch,
});
const cloudSave = (patch: Partial<CloudSave> = {}): CloudSave => ({
  save: '{"cloud":true}',
  rev: 7,
  savedAt: T0 - 5_000,
  summary: summary({ lifetimeCoins: '5000', diplomasEarned: 1 }),
  ...patch,
});

const ok = <T,>(data: T): ApiResult<T> => ({ ok: true, data });
const syncOk = (rev: number, multiplier = 1): ApiResult<SyncResponse> =>
  ok({ status: 'ok', rev, serverTime: T0, multiplier, me: guest });
const syncConflict = (cloud = cloudSave()): ApiResult<SyncResponse> =>
  ok({ status: 'conflict', cloud, multiplier: 1, me: guest });
const failure = (code: 'unavailable' | 'internal' | 'rate_limited' | 'wrong_credentials', status: number, message = 'Erro.') =>
  ({ ok: false, error: { code, message }, status }) as const;
const network = failure('unavailable', 0, 'Sem conexão com o servidor.');

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}
function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

function setup(options: { stored?: string; visible?: boolean } = {}) {
  let time = T0;
  const timers: { id: number; at: number; fn: () => void }[] = [];
  let nextId = 0;
  const data = new Map<string, string>();
  if (options.stored) data.set(CLOUD_KEY, options.stored);
  const storage: StorageLike = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };

  const syncCalls: { body: { save: string; baseRev: number; force?: boolean }; keepalive: boolean | undefined }[] = [];
  const queues = {
    me: [] as (() => Promise<unknown> | unknown)[],
    sync: [] as (() => Promise<ApiResult<SyncResponse>> | ApiResult<SyncResponse>)[],
  };
  const calls = { me: 0, login: 0, logout: 0 };
  const loginResult: { value: unknown } = { value: null };
  const nicknameResult: { value: unknown } = { value: null };

  const api = {
    me: async () => {
      calls.me += 1;
      const next = queues.me.shift();
      return (next ? await next() : ok({ me: guest, multiplier: 1, cloud: null })) as Awaited<ReturnType<CloudDeps['api']['me']>>;
    },
    sync: async (body: { save: string; baseRev: number; force?: boolean }, opts: { keepalive?: boolean } = {}) => {
      syncCalls.push({ body, keepalive: opts.keepalive });
      const next = queues.sync.shift();
      return next ? await next() : syncOk(body.baseRev + 1);
    },
    login: async () => {
      calls.login += 1;
      return loginResult.value as Awaited<ReturnType<CloudDeps['api']['login']>>;
    },
    logout: async () => {
      calls.logout += 1;
      return ok({ ok: true as const });
    },
    setNickname: async () => nicknameResult.value as Awaited<ReturnType<CloudDeps['api']['setNickname']>>,
    setPassword: async () => nicknameResult.value as Awaited<ReturnType<CloudDeps['api']['setPassword']>>,
  } satisfies CloudDeps['api'];

  const listeners = new Set<(event: GameEvent) => void>();
  const gameState = { multiplier: 1, local: summary({ playSeconds: 600 }), adopted: [] as string[], adoptOk: true };
  const game: CloudDeps['game'] = {
    serialize: () => '{"local":true}',
    adopt: (text) => {
      gameState.adopted.push(text);
      // The real store announces the replaced save.
      if (gameState.adoptOk) listeners.forEach((l) => l({ type: 'loaded' }));
      return gameState.adoptOk;
    },
    summary: () => gameState.local,
    multiplier: () => gameState.multiplier,
    setMultiplier: (value) => {
      gameState.multiplier = value;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  const envState = { visible: options.visible ?? true };
  const visibilityListeners = new Set<(visible: boolean) => void>();
  const hideListeners = new Set<() => void>();
  const env: CloudEnv = {
    visible: () => envState.visible,
    onVisibility: (l) => {
      visibilityListeners.add(l);
      return () => visibilityListeners.delete(l);
    },
    onPageHide: (l) => {
      hideListeners.add(l);
      return () => hideListeners.delete(l);
    },
  };

  const store = createCloudStore({
    api,
    game,
    env,
    storage: () => storage,
    now: () => time,
    timers: {
      set: (fn, ms) => {
        nextId += 1;
        timers.push({ id: nextId, at: time + ms, fn });
        return nextId;
      },
      clear: (handle) => {
        const index = timers.findIndex((t) => t.id === handle);
        if (index >= 0) timers.splice(index, 1);
      },
    },
  });

  /** Moves the clock, firing due timers in order, letting each request settle. */
  const advance = async (ms: number) => {
    const end = time + ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at);
      const next = timers[0];
      if (!next || next.at > end) break;
      timers.shift();
      time = Math.max(time, next.at);
      next.fn();
      await settle();
    }
    time = end;
  };

  return {
    store,
    syncCalls,
    queues,
    calls,
    storage,
    data,
    gameState,
    loginResult,
    nicknameResult,
    advance,
    emit: (event: GameEvent) => listeners.forEach((l) => l(event)),
    setVisible: (visible: boolean) => {
      envState.visible = visible;
      visibilityListeners.forEach((l) => l(visible));
    },
    pageHide: () => hideListeners.forEach((l) => l()),
    pendingTimers: () => timers.length,
    start: async () => {
      store.getState().start();
      await settle();
    },
  };
}

describe('cloud store', () => {
  it('asks who we are, syncs once and settles as synced', async () => {
    const t = setup();
    await t.start();
    const state = t.store.getState();
    expect(t.calls.me).toBe(1);
    expect(t.syncCalls).toHaveLength(1);
    expect(t.syncCalls[0]?.body.baseRev).toBe(0);
    expect(state.status).toBe('synced');
    expect(state.me).toEqual(guest);
    expect(state.lastSyncedAt).toBe(T0);
    expect(JSON.parse(t.data.get(CLOUD_KEY) ?? '{}')).toEqual({ rev: 1, force: false });
  });

  it('start() twice does not double up', async () => {
    const t = setup();
    t.store.getState().start();
    t.store.getState().start();
    await settle();
    expect(t.calls.me).toBe(1);
    expect(t.syncCalls).toHaveLength(1);
  });

  it('keeps the revision between sessions and sends it as baseRev', async () => {
    const t = setup({ stored: JSON.stringify({ rev: 9, force: false }) });
    await t.start();
    expect(t.syncCalls[0]?.body.baseRev).toBe(9);
    expect(t.syncCalls[0]?.body.force).toBeUndefined();
  });

  it('syncs every interval while visible, not while hidden', async () => {
    const t = setup();
    await t.start();
    await t.advance(SYNC_INTERVAL_MS - 1);
    expect(t.syncCalls).toHaveLength(1);
    await t.advance(1);
    expect(t.syncCalls).toHaveLength(2);
    expect(t.syncCalls[1]?.body.baseRev).toBe(1);

    t.setVisible(false); // flushes once
    await settle();
    expect(t.syncCalls).toHaveLength(3);
    expect(t.syncCalls[2]?.keepalive).toBe(true);
    await t.advance(SYNC_INTERVAL_MS * 3);
    expect(t.syncCalls).toHaveLength(3);

    t.setVisible(true);
    await t.advance(0);
    expect(t.syncCalls).toHaveLength(4);
  });

  it('flushes on pagehide with keepalive', async () => {
    const t = setup();
    await t.start();
    t.pageHide();
    await settle();
    expect(t.syncCalls).toHaveLength(2);
    expect(t.syncCalls[1]?.keepalive).toBe(true);
  });

  it('syncs shortly after a hire or a graduation, once per burst, respecting the minimum gap', async () => {
    const t = setup();
    await t.start();
    t.emit({ type: 'hire', professor: 'angelo' });
    t.emit({ type: 'graduate', diplomas: 3 });
    await t.advance(EVENT_DELAY_MS);
    expect(t.syncCalls).toHaveLength(1); // the first sync was less than MIN_GAP ago
    await t.advance(10_000);
    expect(t.syncCalls).toHaveLength(2);
    await t.advance(1_000);
    expect(t.syncCalls).toHaveLength(2);
  });

  it('never has two requests in flight and folds extra requests into one follow-up', async () => {
    const t = setup();
    const gate = deferred<ApiResult<SyncResponse>>();
    t.queues.sync.push(() => gate.promise);
    t.store.getState().start();
    await settle();
    const first = t.store.getState().syncNow();
    const second = t.store.getState().syncNow();
    await settle();
    expect(t.syncCalls).toHaveLength(1);
    gate.resolve(syncOk(1));
    await Promise.all([first, second]);
    await settle();
    expect(t.syncCalls).toHaveLength(1);
    await t.advance(10_000);
    expect(t.syncCalls).toHaveLength(2);
    expect(t.syncCalls[1]?.body.baseRev).toBe(1);
  });

  describe('failures', () => {
    it('backs off exponentially up to the cap, then recovers', async () => {
      const t = setup();
      for (let i = 0; i < 7; i += 1) t.queues.sync.push(() => network);
      t.queues.me.push(() => network);
      await t.start();
      expect(t.store.getState().status).toBe('offline');
      expect(t.store.getState().unavailable).toBe(false);
      expect(t.calls.me).toBe(1);

      await t.advance(BACKOFF_BASE_MS - 1);
      expect(t.calls.me).toBe(1);
      await t.advance(1); // retry 1 after 10 s: me works now, the sync fails
      expect(t.calls.me).toBe(2);
      expect(t.syncCalls).toHaveLength(1);

      await t.advance(BACKOFF_BASE_MS * 2 - 1);
      expect(t.syncCalls).toHaveLength(1);
      await t.advance(1);
      expect(t.syncCalls).toHaveLength(2);

      await t.advance(BACKOFF_BASE_MS * 4);
      expect(t.syncCalls).toHaveLength(3);
      await t.advance(BACKOFF_BASE_MS * 8);
      await t.advance(BACKOFF_BASE_MS * 16);
      expect(t.syncCalls).toHaveLength(5);
      // 10 s * 2^5 = 320 s is above the 300 s cap
      await t.advance(BACKOFF_MAX_MS - 1);
      expect(t.syncCalls).toHaveLength(5);
      await t.advance(1);
      expect(t.syncCalls).toHaveLength(6);

      await t.advance(BACKOFF_MAX_MS);
      expect(t.syncCalls).toHaveLength(7);
      await t.advance(BACKOFF_MAX_MS);
      expect(t.syncCalls).toHaveLength(8); // the queue of failures is spent: this one succeeds
      expect(t.store.getState().status).toBe('synced');
    });

    it('treats a backend that is not configured as quiet: retried every few minutes only', async () => {
      const t = setup();
      t.queues.me.push(() => failure('unavailable', 503));
      await t.start();
      expect(t.store.getState().status).toBe('offline');
      expect(t.store.getState().unavailable).toBe(true);
      await t.advance(UNAVAILABLE_RETRY_MS - 1);
      expect(t.calls.me).toBe(1);
      await t.advance(1);
      expect(t.calls.me).toBe(2);
    });

    it('treats a missing route (404) like an unavailable backend', async () => {
      const t = setup();
      t.queues.me.push(() => failure('internal', 404));
      await t.start();
      expect(t.store.getState().unavailable).toBe(true);
    });

    it('waits after a rate limit without flipping the indicator to offline', async () => {
      const t = setup();
      await t.start();
      t.queues.sync.push(() => failure('rate_limited', 429));
      await t.advance(SYNC_INTERVAL_MS);
      expect(t.syncCalls).toHaveLength(2);
      expect(t.store.getState().status).toBe('synced');
      await t.advance(59_000);
      expect(t.syncCalls).toHaveLength(2);
      await t.advance(1_000);
      expect(t.syncCalls).toHaveLength(3);
    });

    it('survives a request that throws', async () => {
      const t = setup();
      t.queues.sync.push(() => Promise.reject(new Error('boom')));
      await t.start();
      expect(t.store.getState().status).toBe('offline');
    });
  });

  describe('conflict', () => {
    async function conflicted() {
      const t = setup();
      t.queues.sync.push(() => syncConflict());
      await t.start();
      return t;
    }

    it('stops syncing and waits for the player', async () => {
      const t = await conflicted();
      const state = t.store.getState();
      expect(state.status).toBe('conflict');
      expect(state.conflict?.origin).toBe('sync');
      expect(state.conflict?.cloud.rev).toBe(7);
      await t.advance(SYNC_INTERVAL_MS * 5);
      t.pageHide();
      await settle();
      expect(t.syncCalls).toHaveLength(1);
    });

    it('adopts the cloud save and continues from its revision', async () => {
      const t = await conflicted();
      t.store.getState().useCloudSave();
      expect(t.gameState.adopted).toEqual(['{"cloud":true}']);
      const state = t.store.getState();
      expect(state.conflict).toBeNull();
      expect(state.status).toBe('synced');
      expect(JSON.parse(t.data.get(CLOUD_KEY) ?? '{}').rev).toBe(7); // the "loaded" event of the adoption did not reset it
      await t.advance(10_000);
      expect(t.syncCalls[1]?.body.baseRev).toBe(7);
      expect(t.syncCalls[1]?.body.force).toBeUndefined();
    });

    describe('a sync that landed after the page closed', () => {
      const stored = (baseRev: number) =>
        JSON.stringify({ rev: baseRev, force: false, pending: [{ baseRev, summary: summary() }] });

      it('is recognized as our own write instead of asking the player', async () => {
        const t = setup({ stored: stored(3) });
        t.queues.sync.push(() => syncConflict(cloudSave({ rev: 4, summary: summary() })));
        await t.start();
        expect(t.store.getState().conflict).toBeNull();
        expect(t.store.getState().status).toBe('synced');
        await t.advance(10_000);
        expect(t.syncCalls[1]?.body.baseRev).toBe(4);
        expect(t.syncCalls[1]?.body.force).toBeUndefined();
      });

      it('matches the request of the previous page even though time moved on since', async () => {
        const t = setup({ stored: stored(3) });
        t.gameState.local = summary({ playSeconds: 640 }); // the game kept running after the request was sent
        t.queues.sync.push(() => syncConflict(cloudSave({ rev: 4, summary: summary() })));
        await t.start();
        expect(t.store.getState().status).toBe('synced');
      });

      it('still asks when another device wrote in the meantime', async () => {
        const t = setup({ stored: stored(3) });
        t.queues.sync.push(() => syncConflict(cloudSave({ rev: 4, summary: summary({ playSeconds: 5000 }) })));
        await t.start();
        expect(t.store.getState().status).toBe('conflict');
      });

      it('does not excuse a jump of more than one revision', async () => {
        const t = setup({ stored: stored(3) });
        t.queues.sync.push(() => syncConflict(cloudSave({ rev: 6, summary: summary() })));
        await t.start();
        expect(t.store.getState().status).toBe('conflict');
      });

      it('clears the record once the server answers, and keeps it after a lost connection', async () => {
        const t = setup();
        await t.start();
        expect(JSON.parse(t.data.get(CLOUD_KEY) ?? '{}').pending).toBeUndefined();
        t.queues.sync.push(() => network);
        await t.advance(SYNC_INTERVAL_MS);
        expect(JSON.parse(t.data.get(CLOUD_KEY) ?? '{}').pending.at(-1).baseRev).toBe(1);
      });
    });

    it('keeps the conflict when the cloud save cannot be read', async () => {
      const t = await conflicted();
      t.gameState.adoptOk = false;
      t.store.getState().useCloudSave();
      expect(t.store.getState().status).toBe('conflict');
    });

    it('keeps the local save by syncing with force', async () => {
      const t = await conflicted();
      t.queues.sync.push(() => syncOk(8));
      await t.store.getState().keepLocalSave();
      expect(t.syncCalls[1]?.body.force).toBe(true);
      expect(t.syncCalls[1]?.body.baseRev).toBe(7);
      const state = t.store.getState();
      expect(state.conflict).toBeNull();
      expect(state.status).toBe('synced');
      expect(JSON.parse(t.data.get(CLOUD_KEY) ?? '{}').rev).toBe(8);
      await t.advance(SYNC_INTERVAL_MS);
      expect(t.syncCalls[2]?.body.baseRev).toBe(8);
    });

    it('keeps the dialog open when the forced sync fails', async () => {
      const t = await conflicted();
      t.queues.sync.push(() => network);
      await t.store.getState().keepLocalSave();
      expect(t.store.getState().conflict).not.toBeNull();
      expect(t.store.getState().status).toBe('conflict');
    });
  });

  describe('multiplier', () => {
    it('is 1 on boot even when the save carries another value, then follows the server', async () => {
      const t = setup();
      t.gameState.multiplier = 50;
      t.queues.me.push(() => ok({ me: guest, multiplier: 2, cloud: null }));
      t.queues.sync.push(() => syncOk(1, 2));
      t.store.getState().start();
      expect(t.gameState.multiplier).toBe(1);
      await settle();
      expect(t.gameState.multiplier).toBe(2);
      expect(t.store.getState().multiplier).toBe(2);
    });

    it('applies every change the server sends and keeps the last one while offline', async () => {
      const t = setup();
      await t.start();
      t.queues.sync.push(() => syncOk(2, 10));
      await t.advance(SYNC_INTERVAL_MS);
      expect(t.gameState.multiplier).toBe(10);
      t.queues.sync.push(() => network);
      await t.advance(SYNC_INTERVAL_MS);
      expect(t.store.getState().status).toBe('offline');
      expect(t.gameState.multiplier).toBe(10);
      expect(t.store.getState().multiplier).toBe(10);
    });
  });

  describe('hard reset', () => {
    it('overwrites the cloud on the next sync and stops forcing afterwards', async () => {
      const t = setup({ stored: JSON.stringify({ rev: 5, force: false }) });
      await t.start();
      t.emit({ type: 'reset' });
      expect(JSON.parse(t.data.get(CLOUD_KEY) ?? '{}')).toEqual({ rev: 0, force: true });
      await t.advance(10_000);
      const forced = t.syncCalls[1];
      expect(forced?.body.force).toBe(true);
      expect(forced?.body.baseRev).toBe(0);
      expect(JSON.parse(t.data.get(CLOUD_KEY) ?? '{}')).toEqual({ rev: 1, force: false });
      await t.advance(SYNC_INTERVAL_MS);
      expect(t.syncCalls[2]?.body.force).toBeUndefined();
    });

    it('remembers a pending reset across a reload', async () => {
      const t = setup({ stored: JSON.stringify({ rev: 0, force: true }) });
      await t.start();
      expect(t.syncCalls[0]?.body.force).toBe(true);
    });

    it('drops a conflict dialog that the reset answers', async () => {
      const t = setup();
      t.queues.sync.push(() => syncConflict());
      await t.start();
      t.emit({ type: 'reset' });
      expect(t.store.getState().conflict).toBeNull();
      await t.advance(10_000);
      expect(t.syncCalls[1]?.body.force).toBe(true);
    });

    it('forgets the revision when the player imports another save', async () => {
      const t = setup();
      await t.start();
      t.emit({ type: 'loaded' });
      expect(JSON.parse(t.data.get(CLOUD_KEY) ?? '{}')).toEqual({ rev: 0, force: false });
    });

    it('drops the answer of a request that was out while the save was replaced', async () => {
      const t = setup();
      const gate = deferred<ApiResult<SyncResponse>>();
      t.queues.sync.push(() => gate.promise);
      t.store.getState().start();
      await settle();
      t.emit({ type: 'reset' });
      gate.resolve(syncOk(40));
      await settle();
      expect(JSON.parse(t.data.get(CLOUD_KEY) ?? '{}')).toEqual({ rev: 0, force: true });
    });
  });

  describe('login', () => {
    const loginOk = (cloud: CloudSave | null) =>
      ok({ me: { ...guest, nickname: 'Ana', hasPassword: true, ranked: true, unrankedReason: null }, multiplier: 3, cloud });

    it('returns the server message when the credentials are wrong', async () => {
      const t = setup();
      await t.start();
      t.loginResult.value = failure('wrong_credentials', 401, 'Apelido ou senha incorretos.');
      const result = await t.store.getState().login('Ana', 'errada1');
      expect(result).toEqual({ ok: false, error: { code: 'wrong_credentials', message: 'Apelido ou senha incorretos.' } });
      expect(t.store.getState().conflict).toBeNull();
    });

    it('adopts the account save silently on a fresh device', async () => {
      const t = setup();
      await t.start();
      t.gameState.local = summary({ playSeconds: 20, lifetimeCoins: '10' });
      t.loginResult.value = loginOk(cloudSave());
      expect(await t.store.getState().login('Ana', 'segredo')).toEqual({ ok: true });
      const state = t.store.getState();
      expect(t.gameState.adopted).toEqual(['{"cloud":true}']);
      expect(state.conflict).toBeNull();
      expect(state.me?.nickname).toBe('Ana');
      expect(state.multiplier).toBe(3);
      expect(JSON.parse(t.data.get(CLOUD_KEY) ?? '{}').rev).toBe(7);
    });

    it('asks when the device has progress that differs from the account', async () => {
      const t = setup();
      await t.start();
      t.loginResult.value = loginOk(cloudSave());
      await t.store.getState().login('Ana', 'segredo');
      const state = t.store.getState();
      expect(state.status).toBe('conflict');
      expect(state.conflict?.origin).toBe('login');
      expect(t.gameState.adopted).toEqual([]);
      t.queues.sync.push(() => syncOk(8));
      await t.store.getState().keepLocalSave();
      expect(t.syncCalls.at(-1)?.body.force).toBe(true);
      expect(t.store.getState().conflict).toBeNull();
    });

    it('does not ask when the device already has the same progress as the account', async () => {
      const t = setup();
      await t.start();
      t.gameState.local = summary({ lifetimeCoins: '5000', diplomasEarned: 1, playSeconds: 900 });
      t.loginResult.value = loginOk(cloudSave());
      await t.store.getState().login('Ana', 'segredo');
      expect(t.store.getState().conflict).toBeNull();
      expect(t.gameState.adopted).toEqual([]);
      expect(JSON.parse(t.data.get(CLOUD_KEY) ?? '{}').rev).toBe(7);
    });

    it('keeps the device save when the account has none yet', async () => {
      const t = setup();
      await t.start();
      t.loginResult.value = loginOk(null);
      await t.store.getState().login('Ana', 'segredo');
      expect(t.store.getState().conflict).toBeNull();
      await t.advance(10_000);
      expect(t.syncCalls.at(-1)?.body.baseRev).toBe(0);
    });
  });

  describe('account', () => {
    it('returns the server error and keeps the identity when setting a nickname fails', async () => {
      const t = setup();
      await t.start();
      t.nicknameResult.value = failure('internal', 409, 'Esse apelido já está em uso.');
      const result = await t.store.getState().setNickname('Ana');
      expect(result.ok).toBe(false);
      expect(t.store.getState().me?.nickname).toBeNull();
    });

    it('updates the identity and syncs soon when a nickname is set', async () => {
      const t = setup();
      await t.start();
      t.nicknameResult.value = ok({ me: { ...guest, nickname: 'Ana', ranked: true, unrankedReason: null } });
      expect(await t.store.getState().setNickname('Ana')).toEqual({ ok: true });
      expect(t.store.getState().me?.nickname).toBe('Ana');
      await t.advance(10_000);
      expect(t.syncCalls).toHaveLength(2);
    });

    it('logs out: new guest on the next sync, with no revision and no multiplier', async () => {
      const t = setup();
      t.queues.me.push(() => ok({ me: guest, multiplier: 4, cloud: null }));
      await t.start();
      await t.store.getState().logout();
      const state = t.store.getState();
      expect(t.calls.logout).toBe(1);
      expect(state.me).toBeNull();
      expect(state.multiplier).toBe(1);
      expect(t.gameState.multiplier).toBe(1);
      expect(JSON.parse(t.data.get(CLOUD_KEY) ?? '{}')).toEqual({ rev: 0, force: false });
      await t.advance(10_000);
      expect(t.syncCalls.at(-1)?.body.baseRev).toBe(0);
    });
  });

  it('stop() silences timers and listeners', async () => {
    const t = setup();
    await t.start();
    t.store.getState().stop();
    expect(t.pendingTimers()).toBe(0);
    t.emit({ type: 'hire', professor: 'angelo' });
    t.pageHide();
    await t.advance(SYNC_INTERVAL_MS * 2);
    expect(t.syncCalls).toHaveLength(1);
  });
});
