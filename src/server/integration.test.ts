/**
 * Integration tests against the `adsclicker_test` database (see testing/db.ts). They skip
 * themselves when it cannot be reached, so `npx vitest run` still passes without Docker.
 */
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { content } from '@/game/content';
import { deserializeState, serializeState } from '@/game/engine';
import type { GameState } from '@/game/engine/state';
import type { SyncRequest } from '@/shared/api';
import { listPlayers, patchPlayer } from './admin/players';
import { currentPlayer, requireSession } from './auth/context';
import { login, logout } from './auth/login';
import { SESSION_COOKIE, findSession, hashToken, readSessionToken, SESSION_TTL_MS } from './auth/session';
import { clearCommunityCache, getCommunity } from './community/community';
import { clearLeaderboardCache, getLeaderboard, getRanks } from './community/leaderboard';
import { resetEventMultiplierCache, setEventMultiplier } from './config/eventMultiplier';
import { feedEvents, players, sessions } from './db/schema';
import { ApiFailure } from './http/errors';
import { getMe } from './players/me';
import { setNickname, setPassword } from './players/account';
import { syncPlayer } from './players/sync';
import { connectTestDb } from './testing/db';
import { playWindows } from './testing/play';

const testDb = await connectTestDb();
afterAll(async () => {
  await testDb?.close();
});

const T0 = Date.UTC(2026, 9, 1, 12, 0, 0);
const MINUTE = 60_000;

/** The Set-Cookie of a response, reduced to the Cookie header a browser would send back. */
function cookieHeader(cookies: string[]): Headers {
  const first = cookies.find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
  return new Headers(first ? { cookie: first.split(';')[0] ?? '' } : {});
}

function tokenOf(cookies: string[]): string {
  const token = readSessionToken(cookieHeader(cookies));
  if (!token) throw new Error('no session cookie in the response');
  return token;
}

/** A believable save: `windows` x 45 s of simulated play with the real content. */
function savesOf(windows: number, options: { seed?: number; clicksPerSecond?: number; graduate?: boolean } = {}): GameState[] {
  return playWindows({ windows, seed: options.seed ?? 1, clicksPerSecond: options.clicksPerSecond ?? 4, graduate: options.graduate ?? false }).map(
    (window) => window.next,
  );
}

const body = (state: GameState, baseRev: number, force?: boolean): SyncRequest => ({
  save: serializeState(state),
  baseRev,
  ...(force ? { force } : {}),
});

async function expectFailure(promise: Promise<unknown>, code: string): Promise<ApiFailure> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(ApiFailure);
  expect((error as ApiFailure).code).toBe(code);
  return error as ApiFailure;
}

describe.skipIf(!testDb)('backend against Postgres', () => {
  if (!testDb) return; // skipped: the describe body still runs while tests are collected
  const { db } = testDb;

  beforeEach(async () => {
    await testDb.reset();
    clearCommunityCache();
    clearLeaderboardCache();
    resetEventMultiplierCache();
  });

  /** Registers a guest with a few syncs and returns what the browser would hold. */
  async function newPlayer(options: { nickname?: string; password?: string; windows?: number; seed?: number; ip?: string } = {}) {
    const states = savesOf(options.windows ?? 3, { seed: options.seed ?? 1 });
    let token: string | null = null;
    let rev = 0;
    let now = T0;
    let id = '';
    for (const state of states) {
      const result = await syncPlayer(db, { request: body(state, rev), token, ip: options.ip ?? '10.0.0.1', now });
      if (result.body.status !== 'ok') throw new Error('unexpected conflict');
      if (result.cookies.length > 0 && token === null) token = tokenOf(result.cookies);
      rev = result.body.rev;
      id = result.body.me.id;
      now += 45_000;
    }
    if (!token) throw new Error('no token');
    const headers = new Headers({ cookie: `${SESSION_COOKIE}=${token}` });
    if (options.nickname) {
      const authed = await requireSession(db, headers, now);
      await setNickname(db, authed, { nickname: options.nickname }, now);
    }
    if (options.password) {
      const authed = await requireSession(db, headers, now);
      await setPassword(db, authed, { password: options.password }, now);
    }
    return { token, headers, rev, id, now, last: states.at(-1)! };
  }

  describe('sync', () => {
    it('creates a guest on the first sync and answers the next ones with the next revision', async () => {
      const [first, second] = savesOf(2);
      const created = await syncPlayer(db, { request: body(first!, 0), token: null, ip: '10.0.0.1', now: T0 });
      expect(created.body).toMatchObject({ status: 'ok', rev: 1, multiplier: 1, me: { nickname: null, ranked: false } });
      expect(created.cookies).toHaveLength(1);
      expect(created.cookies[0]).toContain('HttpOnly');

      const token = tokenOf(created.cookies);
      const next = await syncPlayer(db, { request: body(second!, 1), token, ip: '10.0.0.1', now: T0 + 45_000 });
      expect(next.body).toMatchObject({ status: 'ok', rev: 2 });
      expect(next.cookies).toEqual([]);

      const rows = await db.select().from(players);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ rev: 2, flagged: false, nickname: null });
      expect(rows[0]!.lifetimeCoinsText).toBe(second!.lifetimeCoins.toString());
      expect(rows[0]!.lifetimeCoinsLog).toBeGreaterThan(0);
    });

    it('stores only the hash of the session token', async () => {
      const [state] = savesOf(1);
      const created = await syncPlayer(db, { request: body(state!, 0), token: null, ip: '10.0.0.1', now: T0 });
      const token = tokenOf(created.cookies);
      const stored = await db.select().from(sessions);
      expect(stored).toHaveLength(1);
      expect(stored[0]!.tokenHash).toBe(hashToken(token));
      expect(JSON.stringify(stored)).not.toContain(token);
    });

    it('refuses an unreadable save with `invalid` and creates nobody', async () => {
      await expectFailure(syncPlayer(db, { request: { save: '{"nope":true}', baseRev: 0 }, token: null, ip: '10.0.0.1', now: T0 }), 'invalid');
      await expectFailure(syncPlayer(db, { request: { save: 'not json', baseRev: 0 }, token: null, ip: '10.0.0.1', now: T0 }), 'invalid');
      expect(await db.select().from(players)).toHaveLength(0);
    });

    it('ignores the multiplier the client wrote and applies the server one', async () => {
      const [state] = savesOf(1);
      state!.settings.devMultiplier = 1000;
      const created = await syncPlayer(db, { request: body(state!, 0), token: null, ip: '10.0.0.1', now: T0 });
      expect(created.body).toMatchObject({ status: 'ok', multiplier: 1 });
      const [row] = await db.select({ save: players.save }).from(players);
      expect(deserializeState(row!.save!, content, T0)!.settings.devMultiplier).toBe(1);
    });

    it('applies the event multiplier times the player multiplier', async () => {
      const [first, second, third] = savesOf(3);
      const created = await syncPlayer(db, { request: body(first!, 0), token: null, ip: '10.0.0.1', now: T0 });
      const token = tokenOf(created.cookies);
      await setEventMultiplier(db, 2, T0 + 1_000);
      await db.update(players).set({ multiplier: 5 });
      const next = await syncPlayer(db, { request: body(second!, 1), token, ip: '10.0.0.1', now: T0 + 45_000 });
      expect(next.body).toMatchObject({ status: 'ok', multiplier: 10 });
      const [row] = await db.select({ save: players.save }).from(players);
      expect(deserializeState(row!.save!, content, T0)!.settings.devMultiplier).toBe(10);

      // The multiplier raises the rates the plausibility test measures, so playing at x10 is not a cheat by itself.
      const me = await getMe(db, new Headers({ cookie: `${SESSION_COOKIE}=${token}` }), T0 + 50_000);
      expect(me.body.multiplier).toBe(10);
      void third;
    });

    it('answers a conflict with the cloud save and writes nothing', async () => {
      const [a, b, c] = savesOf(3);
      const created = await syncPlayer(db, { request: body(a!, 0), token: null, ip: '10.0.0.1', now: T0 });
      const token = tokenOf(created.cookies);
      await syncPlayer(db, { request: body(b!, 1), token, ip: '10.0.0.1', now: T0 + 45_000 });

      // Another device still believes the cloud is at revision 1.
      const stale = await syncPlayer(db, { request: body(c!, 1), token, ip: '10.0.0.1', now: T0 + 90_000 });
      expect(stale.body.status).toBe('conflict');
      if (stale.body.status !== 'conflict') throw new Error('unreachable');
      expect(stale.body.cloud.rev).toBe(2);
      expect(stale.body.cloud.summary.lifetimeCoins).toBe(b!.lifetimeCoins.toString());
      expect(deserializeState(stale.body.cloud.save, content, T0)).not.toBeNull();

      const [row] = await db.select({ rev: players.rev, coins: players.lifetimeCoinsText }).from(players);
      expect(row).toEqual({ rev: 2, coins: b!.lifetimeCoins.toString() });
    });

    it('overwrites the cloud when the player forces it, and moves on to the next revision', async () => {
      const [a, b, c] = savesOf(3);
      const created = await syncPlayer(db, { request: body(a!, 0), token: null, ip: '10.0.0.1', now: T0 });
      const token = tokenOf(created.cookies);
      await syncPlayer(db, { request: body(b!, 1), token, ip: '10.0.0.1', now: T0 + 45_000 });
      const forced = await syncPlayer(db, { request: body(c!, 1, true), token, ip: '10.0.0.1', now: T0 + 90_000 });
      expect(forced.body).toMatchObject({ status: 'ok', rev: 3 });
      const [row] = await db.select({ coins: players.lifetimeCoinsText }).from(players);
      expect(row!.coins).toBe(c!.lifetimeCoins.toString());
    });

    it('lets a forced rollback to older progress through without flagging the player', async () => {
      const [a, b, c] = savesOf(3);
      const created = await syncPlayer(db, { request: body(a!, 0), token: null, ip: '10.0.0.1', now: T0 });
      const token = tokenOf(created.cookies);
      await syncPlayer(db, { request: body(c!, 1), token, ip: '10.0.0.1', now: T0 + 45_000 });
      const rolledBack = await syncPlayer(db, { request: body(b!, 2, true), token, ip: '10.0.0.1', now: T0 + 90_000 });
      expect(rolledBack.body).toMatchObject({ status: 'ok', rev: 3 });
      const [row] = await db.select({ flagged: players.flagged, coins: players.lifetimeCoinsText }).from(players);
      expect(row).toEqual({ flagged: false, coins: b!.lifetimeCoins.toString() });
    });

    it('keeps a hand-edited save but flags the player and takes them off the boards', async () => {
      const states = savesOf(3);
      const player = await newPlayer({ nickname: 'Trapaceiro', windows: 3 });
      const cheat = states.at(-1)!;
      cheat.lifetimeCoins = cheat.lifetimeCoins.mul(1e12);
      cheat.runCoins = cheat.runCoins.mul(1e12);
      cheat.coins = cheat.coins.mul(1e12);
      const result = await syncPlayer(db, { request: body(cheat, player.rev), token: player.token, ip: '10.0.0.1', now: player.now + 45_000 });
      expect(result.body).toMatchObject({ status: 'ok', me: { ranked: false } });

      const [row] = await db.select().from(players).where(eq(players.id, player.id));
      expect(row).toMatchObject({ flagged: true, rev: player.rev + 1 });
      expect(row!.flagReason).toContain('coins');
      expect(row!.save).not.toBeNull();

      const board = await getLeaderboard(db, 'coins', player.now + 60_000);
      expect(board.entries.map((entry) => entry.nickname)).not.toContain('Trapaceiro');
    });

    it('rate-limits a player to 6 syncs a minute', async () => {
      const [state] = savesOf(1);
      const created = await syncPlayer(db, { request: body(state!, 0), token: null, ip: '10.0.0.1', now: T0 });
      const token = tokenOf(created.cookies);
      let rev = 1;
      for (let i = 0; i < 5; i += 1) {
        const result = await syncPlayer(db, { request: body(state!, rev), token, ip: '10.0.0.1', now: T0 + 1_000 * (i + 1) });
        if (result.body.status === 'ok') rev = result.body.rev;
      }
      const refused = await expectFailure(syncPlayer(db, { request: body(state!, rev), token, ip: '10.0.0.1', now: T0 + 10_000 }), 'rate_limited');
      expect(refused.retryAfterSeconds).toBeGreaterThan(0);
      // The next minute is a fresh window.
      const later = await syncPlayer(db, { request: body(state!, rev), token, ip: '10.0.0.1', now: T0 + MINUTE });
      expect(later.body.status).toBe('ok');
    });

    it('limits guest creation to 20 an hour per address', async () => {
      const [state] = savesOf(1);
      for (let i = 0; i < 20; i += 1) {
        await syncPlayer(db, { request: body(state!, 0), token: null, ip: '10.9.9.9', now: T0 + i });
      }
      await expectFailure(syncPlayer(db, { request: body(state!, 0), token: null, ip: '10.9.9.9', now: T0 + 100 }), 'rate_limited');
      // Another address is unaffected.
      const other = await syncPlayer(db, { request: body(state!, 0), token: null, ip: '10.9.9.8', now: T0 + 100 });
      expect(other.body.status).toBe('ok');
    });

    it('writes feed events for hires and graduations of ranked players, once', async () => {
      const player = await newPlayer({ nickname: 'Maria Silva', windows: 2 });
      const before = (await db.select().from(feedEvents)).map((event) => event.kind);
      expect(before).toEqual(['joined']);

      // The next save, built from the serialized text so Decimals stay strings.
      const saved = JSON.parse(serializeState(player.last)) as Record<string, unknown>;
      (saved.hired as Record<string, boolean>).gladimir = true;
      (saved.counters as Record<string, number>).graduations = player.last.counters.graduations + 1;
      const request = { save: JSON.stringify(saved), baseRev: player.rev };
      const sync = await syncPlayer(db, { request, token: player.token, ip: '10.0.0.1', now: player.now + 45_000 });
      expect(sync.body.status).toBe('ok');

      const kinds = (await db.select().from(feedEvents)).map((event) => `${event.kind}:${event.detail}`).sort();
      expect(kinds).toEqual([`graduation:${player.last.counters.graduations + 1}`, 'hire:gladimir', 'joined:'].sort());

      // The same save again announces nothing new.
      const again = await syncPlayer(db, {
        request: { ...request, baseRev: player.rev + 1 },
        token: player.token,
        ip: '10.0.0.1',
        now: player.now + 90_000,
      });
      expect(again.body.status).toBe('ok');
      expect(await db.select().from(feedEvents)).toHaveLength(3);
    });

    it('writes no feed events for a player without a nickname', async () => {
      const player = await newPlayer({ windows: 2 });
      const saved = JSON.parse(serializeState(player.last)) as Record<string, unknown>;
      (saved.hired as Record<string, boolean>).gladimir = true;
      await syncPlayer(db, { request: { save: JSON.stringify(saved), baseRev: player.rev }, token: player.token, ip: '10.0.0.1', now: player.now + 45_000 });
      expect(await db.select().from(feedEvents)).toHaveLength(0);
    });
  });

  describe('sessions', () => {
    it('finds the player of a live session, renews it late in life and forgets an expired one', async () => {
      const player = await newPlayer({ windows: 1 });
      const fresh = await findSession(db, player.token, player.now + 1_000);
      expect(fresh).toMatchObject({ renewed: false, player: { id: player.id } });

      const tokenHash = hashToken(player.token);
      await db.update(sessions).set({ expiresAt: new Date(player.now + SESSION_TTL_MS - 2 * 24 * 60 * 60 * 1000) }).where(eq(sessions.tokenHash, tokenHash));
      // Used two days after the last renewal: the expiry moves forward and the cookie must be sent again.
      const renewed = await findSession(db, player.token, player.now);
      expect(renewed?.renewed).toBe(true);
      const [row] = await db.select().from(sessions);
      expect(row!.expiresAt.getTime()).toBe(player.now + SESSION_TTL_MS);

      await db.update(sessions).set({ expiresAt: new Date(player.now - 1) });
      expect(await findSession(db, player.token, player.now)).toBeNull();
      expect(await currentPlayer(db, player.headers, player.now)).toBeNull();
      await expectFailure(requireSession(db, player.headers, player.now), 'unauthorized');
    });
  });

  describe('account', () => {
    it('picks a nickname, ignoring case and accents for uniqueness', async () => {
      const maria = await newPlayer({ nickname: 'Maria', seed: 1, ip: '10.0.1.1' });
      const other = await newPlayer({ seed: 2, ip: '10.0.1.2' });
      const authed = await requireSession(db, other.headers, other.now);
      const taken = await expectFailure(setNickname(db, authed, { nickname: 'MÁRIA' }, other.now), 'nickname_taken');
      expect(taken.message).toBe('Esse apelido já está em uso.');

      const [row] = await db.select({ nickname: players.nickname }).from(players).where(eq(players.id, maria.id));
      expect(row!.nickname).toBe('Maria');

      // The owner may change the capitalisation of their own nickname.
      const owner = await requireSession(db, maria.headers, maria.now);
      const changed = await setNickname(db, owner, { nickname: 'MARIA' }, maria.now);
      expect(changed.me.nickname).toBe('MARIA');
    });

    it('refuses blocked nicknames', async () => {
      const player = await newPlayer({ windows: 1 });
      const authed = await requireSession(db, player.headers, player.now);
      for (const nickname of ['Admin', 'Moderador', 'p.u.t.a']) {
        await expectFailure(setNickname(db, authed, { nickname }, player.now), 'invalid');
      }
    });

    it('puts the player on the boards and in the feed once they pick a nickname', async () => {
      const player = await newPlayer({ windows: 2 });
      expect((await getMe(db, player.headers, player.now)).body.me).toMatchObject({ nickname: null, ranked: false });
      const authed = await requireSession(db, player.headers, player.now);
      const result = await setNickname(db, authed, { nickname: 'Estrela' }, player.now);
      expect(result.me).toMatchObject({ nickname: 'Estrela', ranked: true, unrankedReason: null });
      const board = await getLeaderboard(db, 'coins', player.now);
      expect(board.entries.map((entry) => entry.nickname)).toEqual(['Estrela']);
      const community = await getCommunity(db, player.now);
      expect(community.feed.map((item) => [item.nickname, item.kind])).toEqual([['Estrela', 'joined']]);
    });

    it('limits nickname changes to 5 an hour', async () => {
      const player = await newPlayer({ windows: 1 });
      const authed = await requireSession(db, player.headers, player.now);
      for (let i = 0; i < 5; i += 1) await setNickname(db, authed, { nickname: `Nome${i}x` }, player.now + i);
      await expectFailure(setNickname(db, authed, { nickname: 'Nome9x' }, player.now + 10), 'rate_limited');
    });

    it('sets a password once and requires the current one to change it, signing out other devices', async () => {
      const player = await newPlayer({ nickname: 'Maria Silva', password: 'segredo1' });
      const second = await login(db, { nickname: 'maria silva', password: 'segredo1' }, { ip: '10.0.2.1', currentToken: null, now: player.now });
      const secondToken = tokenOf(second.cookies);

      const authed = await requireSession(db, player.headers, player.now);
      await expectFailure(setPassword(db, authed, { password: 'outra-senha' }, player.now), 'invalid');
      await expectFailure(setPassword(db, authed, { password: 'outra-senha', currentPassword: 'errada' }, player.now), 'wrong_credentials');
      const changed = await setPassword(db, authed, { password: 'outra-senha', currentPassword: 'segredo1' }, player.now);
      expect(changed.me.hasPassword).toBe(true);

      // This browser keeps its session; the other device was signed out.
      expect(await findSession(db, player.token, player.now)).not.toBeNull();
      expect(await findSession(db, secondToken, player.now)).toBeNull();
      await expectFailure(login(db, { nickname: 'Maria Silva', password: 'segredo1' }, { ip: '10.0.2.2', currentToken: null, now: player.now }), 'wrong_credentials');
      const again = await login(db, { nickname: 'Maria Silva', password: 'outra-senha' }, { ip: '10.0.2.2', currentToken: null, now: player.now });
      expect(again.body.me.nickname).toBe('Maria Silva');
    });
  });

  describe('login and logout', () => {
    it('signs in from a clean browser and returns the cloud save', async () => {
      const player = await newPlayer({ nickname: 'Maria Silva', password: 'segredo1', windows: 3 });
      const result = await login(db, { nickname: ' MARIA silva ', password: 'segredo1' }, { ip: '10.0.3.1', currentToken: null, now: player.now });
      expect(result.body.me).toMatchObject({ id: player.id, nickname: 'Maria Silva', hasPassword: true });
      expect(result.body.cloud).toMatchObject({ rev: player.rev });
      expect(deserializeState(result.body.cloud!.save, content, T0)!.lifetimeCoins.toString()).toBe(player.last.lifetimeCoins.toString());
      expect(result.cookies).toHaveLength(1);

      // The new session works for the next requests.
      const headers = cookieHeader(result.cookies);
      expect((await getMe(db, headers, player.now)).body.me?.id).toBe(player.id);
    });

    it('answers identically for an unknown nickname, a wrong password and an account without a password', async () => {
      await newPlayer({ nickname: 'Maria Silva', password: 'segredo1', seed: 1, ip: '10.0.4.1' });
      await newPlayer({ nickname: 'Sem Senha', seed: 2, ip: '10.0.4.2' });
      const attempts = [
        { nickname: 'Maria Silva', password: 'errada1' },
        { nickname: 'Ninguem Aqui', password: 'segredo1' },
        { nickname: 'Sem Senha', password: 'qualquer1' },
      ];
      const failures: ApiFailure[] = [];
      for (const attempt of attempts) failures.push(await expectFailure(login(db, attempt, { ip: '10.0.4.9', currentToken: null, now: T0 }), 'wrong_credentials'));
      expect(new Set(failures.map((failure) => failure.message)).size).toBe(1);
      expect(new Set(failures.map((failure) => failure.status)).size).toBe(1);
    });

    it('limits login attempts to 10 per 10 minutes per address', async () => {
      for (let i = 0; i < 10; i += 1) {
        await expectFailure(login(db, { nickname: `Alguem${i}`, password: 'x' }, { ip: '10.0.5.1', currentToken: null, now: T0 }), 'wrong_credentials');
      }
      await expectFailure(login(db, { nickname: 'Alguem11', password: 'x' }, { ip: '10.0.5.1', currentToken: null, now: T0 }), 'rate_limited');
      await expectFailure(login(db, { nickname: 'Alguem11', password: 'x' }, { ip: '10.0.5.2', currentToken: null, now: T0 }), 'wrong_credentials');
    });

    it('logout ends the session and is safe to repeat', async () => {
      const player = await newPlayer({ windows: 1 });
      const result = await logout(db, player.token);
      expect(result.cookies[0]).toContain('Max-Age=0');
      expect(await findSession(db, player.token, player.now)).toBeNull();
      await expect(logout(db, player.token)).resolves.toBeDefined();
      await expect(logout(db, null)).resolves.toBeDefined();
    });

    it('replaces the guest session of the browser that logs in', async () => {
      const account = await newPlayer({ nickname: 'Maria Silva', password: 'segredo1', seed: 1, ip: '10.0.6.1' });
      const guest = await newPlayer({ seed: 2, ip: '10.0.6.2' });
      await login(db, { nickname: 'Maria Silva', password: 'segredo1' }, { ip: '10.0.6.3', currentToken: guest.token, now: guest.now });
      expect(await findSession(db, guest.token, guest.now)).toBeNull();
      expect(await findSession(db, account.token, account.now)).not.toBeNull();
    });
  });

  describe('boards', () => {
    async function insertPlayer(values: Partial<typeof players.$inferInsert> & { nickname: string | null }) {
      const [row] = await db
        .insert(players)
        .values({
          ...values,
          nicknameKey: values.nickname ? values.nickname.toLowerCase() : null,
          lifetimeCoinsText: values.lifetimeCoinsText ?? '1',
          lifetimeCoins: values.lifetimeCoins ?? values.lifetimeCoinsText ?? '1',
        })
        .returning();
      return row!;
    }

    it('orders by coins even past 1e300, and by the other measures on their boards', async () => {
      await insertPlayer({ nickname: 'Pequeno', lifetimeCoinsText: '5000', lifetimeCoinsLog: Math.log10(5000), diplomasEarned: 50, clicks: 10, achievements: 3 });
      await insertPlayer({ nickname: 'Gigante', lifetimeCoinsText: '2e+305', lifetimeCoins: '2e+305', lifetimeCoinsLog: 305.30103, diplomasEarned: 10, clicks: 5, achievements: 9 });
      await insertPlayer({ nickname: 'Medio', lifetimeCoinsText: '3e+40', lifetimeCoins: '3e+40', lifetimeCoinsLog: 40.477, diplomasEarned: 30, clicks: 999, achievements: 5 });

      const names = async (board: 'coins' | 'diplomas' | 'achievements' | 'clicks') => (await getLeaderboard(db, board, T0)).entries.map((entry) => entry.nickname);
      expect(await names('coins')).toEqual(['Gigante', 'Medio', 'Pequeno']);
      clearLeaderboardCache();
      expect(await names('diplomas')).toEqual(['Pequeno', 'Medio', 'Gigante']);
      clearLeaderboardCache();
      expect(await names('achievements')).toEqual(['Gigante', 'Medio', 'Pequeno']);
      clearLeaderboardCache();
      expect(await names('clicks')).toEqual(['Medio', 'Pequeno', 'Gigante']);

      clearLeaderboardCache();
      const coins = await getLeaderboard(db, 'coins', T0);
      expect(coins.entries[0]).toMatchObject({ rank: 1, value: '2e+305', professor: 'edecio' });
      expect(coins.entries.map((entry) => entry.rank)).toEqual([1, 2, 3]);
    });

    it('leaves out players without a nickname, flagged, banned and test accounts', async () => {
      await insertPlayer({ nickname: 'Honesto', lifetimeCoinsLog: 1 });
      await insertPlayer({ nickname: null, lifetimeCoinsLog: 50 });
      await insertPlayer({ nickname: 'Marcado', lifetimeCoinsLog: 60, flagged: true });
      await insertPlayer({ nickname: 'Banido', lifetimeCoinsLog: 70, banned: true });
      await insertPlayer({ nickname: 'Teste', lifetimeCoinsLog: 80, testAccount: true });
      const board = await getLeaderboard(db, 'coins', T0);
      expect(board.entries.map((entry) => entry.nickname)).toEqual(['Honesto']);
    });

    it('lists at most 100 and marks who is online', async () => {
      for (let i = 0; i < 105; i += 1) {
        await insertPlayer({ nickname: `Jogador${i}`, lifetimeCoinsLog: i, lastSeenAt: new Date(T0 - (i === 104 ? 10_000 : 10 * MINUTE)) });
      }
      const board = await getLeaderboard(db, 'coins', T0);
      expect(board.entries).toHaveLength(100);
      expect(board.entries[0]).toMatchObject({ nickname: 'Jogador104', rank: 1, online: true });
      expect(board.entries[1]).toMatchObject({ nickname: 'Jogador103', online: false });
    });

    it('serves the cached list for 10 seconds', async () => {
      await insertPlayer({ nickname: 'Primeiro', lifetimeCoinsLog: 1 });
      const first = await getLeaderboard(db, 'coins', T0);
      await insertPlayer({ nickname: 'Segundo', lifetimeCoinsLog: 2 });
      expect((await getLeaderboard(db, 'coins', T0 + 9_000)).entries).toHaveLength(1);
      expect((await getLeaderboard(db, 'coins', T0 + 10_000)).entries).toHaveLength(2);
      expect(first.updatedAt).toBe(T0);
    });

    it('computes each player rank, null when not ranked', async () => {
      const top = await insertPlayer({ nickname: 'Topo', lifetimeCoinsLog: 30, diplomasEarned: 1 });
      const mid = await insertPlayer({ nickname: 'Meio', lifetimeCoinsLog: 20, diplomasEarned: 9 });
      const low = await insertPlayer({ nickname: 'Fundo', lifetimeCoinsLog: 10, diplomasEarned: 5 });
      await insertPlayer({ nickname: 'Fora', lifetimeCoinsLog: 99, flagged: true });
      const ranksOf = async (id: string) => {
        const [row] = await db.select().from(players).where(eq(players.id, id));
        const { save: _save, ...core } = row!;
        void _save;
        return (await getRanks(db, core)).ranks;
      };
      expect(await ranksOf(top.id)).toMatchObject({ coins: 1, diplomas: 3 });
      expect(await ranksOf(mid.id)).toMatchObject({ coins: 2, diplomas: 1 });
      expect(await ranksOf(low.id)).toMatchObject({ coins: 3, diplomas: 2 });
      const flagged = await insertPlayer({ nickname: 'Marcado2', lifetimeCoinsLog: 1, flagged: true });
      expect(await ranksOf(flagged.id)).toEqual({ coins: null, diplomas: null, achievements: null, clicks: null });
    });

    it('breaks ties by id, the same way in the list and in the ranks', async () => {
      const rows = [];
      for (let i = 0; i < 5; i += 1) rows.push(await insertPlayer({ nickname: `Igual${i}`, lifetimeCoinsLog: 7, clicks: 100 }));
      const board = await getLeaderboard(db, 'clicks', T0);
      const ordered = [...rows].sort((a, b) => (a.id < b.id ? -1 : 1)).map((row) => row.nickname);
      expect(board.entries.map((entry) => entry.nickname)).toEqual(ordered);
      for (const [index, row] of [...rows].sort((a, b) => (a.id < b.id ? -1 : 1)).entries()) {
        const { save: _save, ...core } = row;
        void _save;
        expect((await getRanks(db, core)).ranks.clicks).toBe(index + 1);
      }
    });
  });

  describe('community', () => {
    it('totals only the players that count and says how many are online', async () => {
      const insert = (values: Partial<typeof players.$inferInsert>) =>
        db.insert(players).values({ lifetimeCoinsText: '1', ...values });
      await insert({ nickname: 'A', nicknameKey: 'a', lifetimeCoins: '1000', graduations: 2, clicks: 500, achievements: 4, lastSeenAt: new Date(T0 - 30_000) });
      await insert({ lifetimeCoins: '2000', graduations: 1, clicks: 250, achievements: 1, lastSeenAt: new Date(T0 - 5 * MINUTE) });
      await insert({ nickname: 'B', nicknameKey: 'b', lifetimeCoins: '1e+30', flagged: true, clicks: 9, lastSeenAt: new Date(T0) });
      await insert({ nickname: 'C', nicknameKey: 'c', lifetimeCoins: '1e+30', banned: true, clicks: 9, lastSeenAt: new Date(T0) });
      await insert({ nickname: 'D', nicknameKey: 'd', lifetimeCoins: '1e+30', testAccount: true, clicks: 9, lastSeenAt: new Date(T0) });

      const community = await getCommunity(db, T0);
      expect(community).toMatchObject({ online: 1, players: 2, graduations: 3, clicks: '750', achievements: 5, eventMultiplier: 1, updatedAt: T0 });
      expect(Number(community.coins)).toBe(3000);
    });

    it('keeps exact counts past 2^53 as text and the coin total in scientific notation', async () => {
      await db.insert(players).values({ lifetimeCoins: '4.5e+305', lifetimeCoinsText: '4.5e+305', clicks: 9_007_199_254_740_000 });
      await db.insert(players).values({ lifetimeCoins: '4.5e+305', lifetimeCoinsText: '4.5e+305', clicks: 9_007_199_254_740_000 });
      const community = await getCommunity(db, T0);
      expect(community.coins).toBe('9e305');
      expect(community.clicks).toBe('18014398509480000');
    });

    it('carries the event multiplier and the latest 30 feed events of ranked players, newest first', async () => {
      await setEventMultiplier(db, 3, T0);
      const [ranked] = await db.insert(players).values({ nickname: 'Rankeado', nicknameKey: 'rankeado' }).returning();
      const [hidden] = await db.insert(players).values({ nickname: 'Escondido', nicknameKey: 'escondido', flagged: true }).returning();
      const [guest] = await db.insert(players).values({}).returning();
      for (let i = 0; i < 35; i += 1) {
        await db.insert(feedEvents).values({ playerId: ranked!.id, kind: 'graduation', detail: String(i), createdAt: new Date(T0 + i * 1000) });
      }
      await db.insert(feedEvents).values({ playerId: hidden!.id, kind: 'joined', detail: '', createdAt: new Date(T0 + 99_000) });
      await db.insert(feedEvents).values({ playerId: guest!.id, kind: 'joined', detail: '', createdAt: new Date(T0 + 99_500) });

      const community = await getCommunity(db, T0 + 100_000);
      expect(community.eventMultiplier).toBe(3);
      expect(community.feed).toHaveLength(30);
      expect(community.feed[0]).toMatchObject({ nickname: 'Rankeado', kind: 'graduation', detail: '34' });
      expect(community.feed.every((item) => item.nickname === 'Rankeado')).toBe(true);
      expect(community.feed.map((item) => item.at)).toEqual([...community.feed.map((item) => item.at)].sort((a, b) => b - a));
    });

    it('serves zeros for an empty community', async () => {
      expect(await getCommunity(db, T0)).toMatchObject({ online: 0, players: 0, coins: '0', clicks: '0', graduations: 0, achievements: 0, feed: [] });
    });
  });

  describe('admin', () => {
    it('lists 25 per page counting from 1, with search ignoring accents and this browser first', async () => {
      const rows: string[] = [];
      for (let i = 0; i < 30; i += 1) {
        const [row] = await db
          .insert(players)
          .values({ nickname: `Aluno ${i}`, nicknameKey: `aluno ${i}`, lastSeenAt: new Date(T0 - i * 1000) })
          .returning({ id: players.id });
        rows.push(row!.id);
      }
      await db.insert(players).values({ nickname: 'Édécio Fã', nicknameKey: 'edecio fa', lastSeenAt: new Date(T0 - 99_000) });

      const page1 = await listPlayers(db, { search: '', page: 1, selfId: null }, T0);
      expect(page1).toMatchObject({ total: 31, page: 1, pageSize: 25, eventMultiplier: 1 });
      expect(page1.players).toHaveLength(25);
      expect(page1.players[0]!.nickname).toBe('Aluno 0');
      const page2 = await listPlayers(db, { search: '', page: 2, selfId: null }, T0);
      expect(page2.players).toHaveLength(6);

      const found = await listPlayers(db, { search: 'EDÉCIO', page: 1, selfId: null }, T0);
      expect(found.players.map((player) => player.nickname)).toEqual(['Édécio Fã']);
      expect((await listPlayers(db, { search: '100%', page: 1, selfId: null }, T0)).total).toBe(0);

      const self = rows[29]!;
      const withSelf = await listPlayers(db, { search: '', page: 1, selfId: self }, T0);
      expect(withSelf.players[0]).toMatchObject({ id: self, self: true });
      expect(withSelf.players.filter((player) => player.self)).toHaveLength(1);
      // A search that does not match this browser's player does not drag it in.
      const miss = await listPlayers(db, { search: 'Édécio', page: 1, selfId: self }, T0);
      expect(miss.players.some((player) => player.self)).toBe(false);
    });

    it('finds a guest by the start of the id', async () => {
      const [guest] = await db.insert(players).values({}).returning({ id: players.id });
      const found = await listPlayers(db, { search: guest!.id.slice(0, 8), page: 1, selfId: null }, T0);
      expect(found.players.map((player) => player.id)).toEqual([guest!.id]);
    });

    it('applies the patch semantics of the contract', async () => {
      const [row] = await db.insert(players).values({ nickname: 'Alvo', nicknameKey: 'alvo' }).returning({ id: players.id });
      const id = row!.id;

      const boosted = await patchPlayer(db, id, { multiplier: 50 }, null, T0);
      expect(boosted.player).toMatchObject({ multiplier: 50, testAccount: true });
      expect((await getLeaderboard(db, 'coins', T0)).entries).toEqual([]);

      const undone = await patchPlayer(db, id, { multiplier: 1, testAccount: false }, null, T0);
      expect(undone.player).toMatchObject({ multiplier: 1, testAccount: false });
      clearLeaderboardCache();
      expect((await getLeaderboard(db, 'coins', T0)).entries).toHaveLength(1);

      const flagged = await patchPlayer(db, id, { flagged: true }, null, T0);
      expect(flagged.player).toMatchObject({ flagged: true, flagReason: 'Marcado pelo admin' });
      const cleared = await patchPlayer(db, id, { flagged: false }, null, T0);
      expect(cleared.player).toMatchObject({ flagged: false, flagReason: null });

      expect((await patchPlayer(db, id, { banned: true }, null, T0)).player.banned).toBe(true);
      expect((await patchPlayer(db, id, { banned: false }, id, T0)).player).toMatchObject({ banned: false, self: true });

      const noName = await patchPlayer(db, id, { clearNickname: true }, null, T0);
      expect(noName.player.nickname).toBeNull();
      // The nickname is free again for anyone.
      await db.insert(players).values({ nickname: 'Alvo', nicknameKey: 'alvo' });

      expect((await patchPlayer(db, id, {}, null, T0)).player.id).toBe(id);
    });

    it('answers not_found for an unknown or malformed id', async () => {
      await expectFailure(patchPlayer(db, '00000000-0000-4000-8000-000000000000', { banned: true }, null, T0), 'not_found');
      await expectFailure(patchPlayer(db, 'nao-e-um-id', { banned: true }, null, T0), 'not_found');
    });

    it('a test account stays off the boards while it plays', async () => {
      const player = await newPlayer({ nickname: 'Demo', windows: 2 });
      await patchPlayer(db, player.id, { multiplier: 10 }, null, player.now);
      const result = await syncPlayer(db, { request: body(player.last, player.rev), token: player.token, ip: '10.0.0.1', now: player.now + 45_000 });
      expect(result.body).toMatchObject({ status: 'ok', multiplier: 10, me: { ranked: false } });
      expect((await getLeaderboard(db, 'coins', player.now)).entries).toEqual([]);
    });
  });

  it('plans the board queries on the partial indexes', async () => {
    await db.execute(sql`insert into players (nickname, nickname_key, lifetime_coins_log, diplomas_earned, achievements, clicks)
      select 'p' || g, 'p' || g, random() * 300, (random() * 1000)::int, (random() * 100)::int, (random() * 1e6)::bigint from generate_series(1, 20000) g`);
    await db.execute(sql`analyze players`);
    const plan = async (order: string) =>
      (
        await db.execute<{ 'QUERY PLAN': string }>(
          sql.raw(
            `explain select nickname from players where nickname is not null and not flagged and not banned and not test_account order by ${order} desc nulls last, id limit 100`,
          ),
        )
      )
        .map((row) => row['QUERY PLAN'])
        .join('\n');
    expect(await plan('lifetime_coins_log')).toContain('players_board_coins_idx');
    expect(await plan('diplomas_earned')).toContain('players_board_diplomas_idx');
    expect(await plan('achievements')).toContain('players_board_achievements_idx');
    expect(await plan('clicks')).toContain('players_board_clicks_idx');
    expect(await plan('lifetime_coins_log')).not.toContain('Sort');
  });
});
