/**
 * Titles, the bulk "Turma Zero" grant, the launch reset and the progress epoch, against Postgres
 * (`adsclicker_titles_test`). Skips itself when the database cannot be reached, like the other
 * integration tests.
 */
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { serializeState } from '@/game/engine';
import type { GameState } from '@/game/engine/state';
import { LAUNCH_RESET_PHRASE, adminPlayerPatchSchema } from '@/shared/api';
import type { SyncRequest } from '@/shared/api';
import { patchPlayer } from '../admin/players';
import { requireSession } from '../auth/context';
import { login } from '../auth/login';
import { SESSION_COOKIE, readSessionToken } from '../auth/session';
import { clearCommunityCache, getCommunity } from '../community/community';
import { clearLeaderboardCache, getLeaderboard, getRanks } from '../community/leaderboard';
import { resetEventMultiplierCache } from '../config/eventMultiplier';
import {
  feedEvents,
  hackathonCollection,
  hackathonItems,
  hackathonProfiles,
  hackathonRuns,
  hackathonStages,
  players,
  sessions,
} from '../db/schema';
import { ApiFailure } from '../http/errors';
import { setNickname } from './account';
import { resetForLaunch, previewLaunchReset } from './launchReset';
import { getMe } from './me';
import { readProgressEpoch } from './progressEpoch';
import { syncPlayer } from './sync';
import { grantTurmaZeroToAll, turmaZeroPreview } from './titles';
import { connectTestDb } from '../testing/db';
import { playWindows } from '../testing/play';

const testDb = await connectTestDb({ database: 'adsclicker_titles_test' });
afterAll(async () => {
  await testDb?.close();
});

const T0 = Date.UTC(2026, 9, 1, 12, 0, 0);

function savesOf(windows: number, seed = 1): GameState[] {
  return playWindows({ windows, seed, clicksPerSecond: 4, graduate: false }).map((window) => window.next);
}

const body = (state: GameState, baseRev: number, epoch?: number): SyncRequest => ({
  save: serializeState(state),
  baseRev,
  ...(epoch === undefined ? {} : { epoch }),
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

describe.skipIf(!testDb)('titles and launch reset against Postgres', () => {
  if (!testDb) return;
  const { db } = testDb;

  beforeEach(async () => {
    await testDb.reset();
    clearCommunityCache();
    clearLeaderboardCache();
    resetEventMultiplierCache();
  });

  /** A player who synced `windows` times; with a nickname when asked. Returns what the device holds. */
  async function newPlayer(options: { nickname?: string; windows?: number; seed?: number; ip?: string } = {}) {
    const states = savesOf(options.windows ?? 3, options.seed ?? 1);
    let token: string | null = null;
    let rev = 0;
    let id = '';
    let now = T0;
    for (const state of states) {
      const result = await syncPlayer(db, { request: body(state, rev, 0), token, ip: options.ip ?? '10.0.0.1', now });
      if (result.body.status !== 'ok') throw new Error(`unexpected ${result.body.status}`);
      if (result.cookies.length > 0 && token === null) {
        token = readSessionToken(new Headers({ cookie: result.cookies[0]?.split(';')[0] ?? '' }));
      }
      rev = result.body.rev;
      id = result.body.me.id;
      now += 45_000;
    }
    if (!token) throw new Error('no token');
    const headers = new Headers({ cookie: `${SESSION_COOKIE}=${token}` });
    if (options.nickname) {
      await setNickname(db, await requireSession(db, headers, now), { nickname: options.nickname, password: 'senha-padrao' }, now);
    }
    return { token, headers, id, rev, now, last: states.at(-1)! };
  }

  const holders = async () => (await db.select({ id: players.id, titles: players.titles }).from(players)).filter((row) => row.titles.length > 0);

  describe('granting and removing a title', () => {
    it('grants and removes one title, and repeating either changes nothing', async () => {
      const ana = await newPlayer({ nickname: 'Ana' });
      const granted = await patchPlayer(db, ana.id, { grantTitle: 'turma-zero' }, null);
      expect(granted.player.titles).toEqual(['turma-zero']);
      const again = await patchPlayer(db, ana.id, { grantTitle: 'turma-zero' }, null);
      expect(again.player.titles).toEqual(['turma-zero']);

      const both = await patchPlayer(db, ana.id, { grantTitle: 'primeiro-platinado' }, null);
      // Highest priority first.
      expect(both.player.titles).toEqual(['primeiro-platinado', 'turma-zero']);

      const removed = await patchPlayer(db, ana.id, { revokeTitle: 'turma-zero' }, null);
      expect(removed.player.titles).toEqual(['primeiro-platinado']);
      const removedAgain = await patchPlayer(db, ana.id, { revokeTitle: 'turma-zero' }, null);
      expect(removedAgain.player.titles).toEqual(['primeiro-platinado']);
    });

    it('does not let a single-holder title go to a second player, until the first one loses it', async () => {
      const ana = await newPlayer({ nickname: 'Ana', ip: '10.0.0.1' });
      const bia = await newPlayer({ nickname: 'Bia', seed: 2, ip: '10.0.0.2' });
      await patchPlayer(db, ana.id, { grantTitle: 'primeiro-platinado' }, null);
      const failure = await expectFailure(patchPlayer(db, bia.id, { grantTitle: 'primeiro-platinado' }, null), 'invalid');
      expect(failure.message).toContain('Ana');
      await patchPlayer(db, ana.id, { revokeTitle: 'primeiro-platinado' }, null);
      const moved = await patchPlayer(db, bia.id, { grantTitle: 'primeiro-platinado' }, null);
      expect(moved.player.titles).toEqual(['primeiro-platinado']);
    });

    it('refuses granting and revoking in the same call, and the schema refuses unknown titles', async () => {
      const ana = await newPlayer({ nickname: 'Ana' });
      await expectFailure(patchPlayer(db, ana.id, { grantTitle: 'turma-zero', revokeTitle: 'turma-zero' }, null), 'invalid');
      expect(adminPlayerPatchSchema.safeParse({ grantTitle: 'rei-do-clicker' }).success).toBe(false);
      expect(adminPlayerPatchSchema.safeParse({ grantTitle: 'turma-zero' }).success).toBe(true);
    });
  });

  describe('showing titles', () => {
    it('puts them on the board entries, the feed and the player\'s own answer, highest priority first', async () => {
      const ana = await newPlayer({ nickname: 'Ana' });
      const bia = await newPlayer({ nickname: 'Bia', seed: 2, ip: '10.0.0.2' });
      await patchPlayer(db, ana.id, { grantTitle: 'turma-zero' }, null);
      await patchPlayer(db, ana.id, { grantTitle: 'primeiro-platinado' }, null);
      await db.insert(feedEvents).values({ playerId: ana.id, kind: 'hire', detail: 'angelo' });
      await db.insert(feedEvents).values({ playerId: bia.id, kind: 'hire', detail: 'angelo' });

      const board = await getLeaderboard(db, 'coins', T0);
      const byName = new Map(board.entries.map((entry) => [entry.nickname, entry]));
      expect(byName.get('Ana')?.titles).toEqual(['primeiro-platinado', 'turma-zero']);
      // A player without titles adds nothing to the payload: old and new clients read the same shape.
      expect(byName.get('Bia')).not.toHaveProperty('titles');

      const community = await getCommunity(db, T0);
      expect(community.feed.find((item) => item.nickname === 'Ana')?.titles).toEqual(['primeiro-platinado', 'turma-zero']);
      expect(community.feed.find((item) => item.nickname === 'Bia')).not.toHaveProperty('titles');

      const me = await getMe(db, ana.headers, T0 + 10 * 60_000);
      expect(me.body.me?.titles).toEqual(['primeiro-platinado', 'turma-zero']);
    });
  });

  describe('Turma Zero for everyone', () => {
    it('counts and grants only accounts with a nickname that synced, and a second run grants nobody', async () => {
      await newPlayer({ nickname: 'Ana', ip: '10.0.0.1' });
      await newPlayer({ nickname: 'Bia', seed: 2, ip: '10.0.0.2' });
      await newPlayer({ seed: 3, ip: '10.0.0.3' }); // a guest: synced, but no nickname
      // A nickname that never synced (rev 0).
      await db.insert(players).values({ nickname: 'Cris', nicknameKey: 'cris' });

      expect(await turmaZeroPreview(db)).toEqual({ eligible: 2, alreadyHave: 0, toGrant: 2 });
      expect(await grantTurmaZeroToAll(db)).toEqual({ granted: 2, alreadyHad: 0 });
      expect(await holders()).toHaveLength(2);
      expect(await turmaZeroPreview(db)).toEqual({ eligible: 2, alreadyHave: 2, toGrant: 0 });
      expect(await grantTurmaZeroToAll(db)).toEqual({ granted: 0, alreadyHad: 2 });
    });

    it('keeps the other titles a player already holds', async () => {
      const ana = await newPlayer({ nickname: 'Ana' });
      await patchPlayer(db, ana.id, { grantTitle: 'primeiro-platinado' }, null);
      await grantTurmaZeroToAll(db);
      const [row] = await db.select({ titles: players.titles }).from(players).where(eq(players.id, ana.id));
      expect([...(row?.titles ?? [])].sort()).toEqual(['primeiro-platinado', 'turma-zero']);
    });
  });

  describe('the launch reset', () => {
    async function seedHackathon(playerId: string) {
      await db.insert(hackathonProfiles).values({ playerId, head: 'h' });
      await db.insert(hackathonItems).values({
        id: crypto.randomUUID(),
        playerId,
        base: 'tool-a',
        rarity: 'rare',
        level: 1,
        affixes: [],
        quality: 0.5,
        createdAt: T0,
      });
      await db.insert(hackathonRuns).values({
        id: crypto.randomUUID(),
        playerId,
        stageId: '1-1',
        seed: 1,
        auto: false,
        build: {},
        stage: {},
        startedAt: new Date(T0),
      });
      await db.insert(hackathonStages).values({ playerId, stageId: '1-1', clears: 1 });
      await db.insert(hackathonCollection).values({ playerId, base: 'tool-a' });
    }

    it('asks for the exact phrase and touches nothing without it', async () => {
      const ana = await newPlayer({ nickname: 'Ana' });
      await expectFailure(resetForLaunch(db, 'zerar', T0), 'invalid');
      await expectFailure(resetForLaunch(db, '', T0), 'invalid');
      const [row] = await db.select().from(players).where(eq(players.id, ana.id));
      expect(row?.save).not.toBeNull();
      expect(row?.rev).toBe(ana.rev);
      expect(await readProgressEpoch(db)).toBe(0);
    });

    it('clears progress, flags, boards, totals, feed and Hackathon, and keeps accounts, passwords, sessions and titles', async () => {
      const ana = await newPlayer({ nickname: 'Ana', ip: '10.0.0.1' });
      const bia = await newPlayer({ nickname: 'Bia', seed: 2, ip: '10.0.0.2' });
      await patchPlayer(db, ana.id, { grantTitle: 'turma-zero' }, null);
      await patchPlayer(db, bia.id, { testAccount: true, banned: true }, null);
      await db.update(players).set({ flagged: true, flagReason: 'Ganho alto demais' }).where(eq(players.id, ana.id));
      await db.insert(feedEvents).values({ playerId: ana.id, kind: 'hire', detail: 'angelo' });
      await seedHackathon(ana.id);
      await seedHackathon(bia.id);

      const [before] = await db.select().from(players).where(eq(players.id, ana.id));
      const feedBefore = (await db.select().from(feedEvents)).length; // two 'joined' plus the hire
      expect(feedBefore).toBe(3);

      const preview = await previewLaunchReset(db);
      expect(preview).toMatchObject({ epoch: 0, players: 2, feedEvents: feedBefore, hackathonRows: 10, withoutTurmaZero: 1 });

      const result = await resetForLaunch(db, ` ${LAUNCH_RESET_PHRASE} `, T0);
      expect(result).toEqual({
        epoch: 1,
        players: 2,
        playersWithProgress: 2,
        feedEvents: feedBefore,
        hackathonProfiles: 2,
        hackathonItems: 2,
        hackathonRuns: 2,
        hackathonStages: 2,
        hackathonCollection: 2,
      });

      const [after] = await db.select().from(players).where(eq(players.id, ana.id));
      expect(after).toMatchObject({
        save: null,
        rev: 0,
        lifetimeCoinsText: '0',
        lifetimeCoinsLog: 0,
        diplomasEarned: 0,
        graduations: 0,
        clicks: 0,
        achievements: 0,
        professors: 1,
        playSeconds: 0,
        avatarProfessor: 'edecio',
        avatarSkin: '',
        flagged: false,
        flagReason: null,
        progressEpoch: 1,
        // kept
        nickname: 'Ana',
        nicknameKey: before?.nicknameKey,
        passwordHash: before?.passwordHash,
        titles: ['turma-zero'],
      });
      expect(after?.passwordHash).not.toBeNull();
      // Moderation marks of the test accounts are not "test-phase flags": they stay.
      const [kept] = await db.select().from(players).where(eq(players.id, bia.id));
      expect(kept).toMatchObject({ testAccount: true, banned: true });

      expect(await db.select().from(sessions)).toHaveLength(2);
      for (const table of [feedEvents, hackathonProfiles, hackathonItems, hackathonRuns, hackathonStages, hackathonCollection]) {
        expect(await db.select().from(table)).toHaveLength(0);
      }

      // The boards, the totals and the feed are empty right away, on this instance too.
      expect((await getLeaderboard(db, 'coins', T0 + 1)).entries[0]).toMatchObject({ nickname: 'Ana', value: '0', diplomas: 0 });
      const community = await getCommunity(db, T0 + 1);
      expect(community).toMatchObject({ coins: '0', graduations: 0, clicks: '0', achievements: 0, feed: [] });

      // The account still logs in with its password and has no cloud save to bring back.
      const logged = await login(db, { nickname: 'Ana', password: 'senha-padrao' }, { ip: '10.0.0.9', currentToken: null, now: T0 + 2 });
      expect(logged.body.cloud).toBeNull();
      expect(logged.body.me.titles).toEqual(['turma-zero']);
    });

    it('is safe to run twice: the second run clears nothing more and only moves the epoch', async () => {
      const ana = await newPlayer({ nickname: 'Ana' });
      await seedHackathon(ana.id);
      await resetForLaunch(db, LAUNCH_RESET_PHRASE, T0);
      const second = await resetForLaunch(db, LAUNCH_RESET_PHRASE, T0 + 1);
      expect(second).toMatchObject({
        epoch: 2,
        players: 1,
        playersWithProgress: 0,
        feedEvents: 0,
        hackathonProfiles: 0,
        hackathonItems: 0,
        hackathonRuns: 0,
        hackathonStages: 0,
        hackathonCollection: 0,
      });
      expect((await previewLaunchReset(db)).players).toBe(0);
    });

    it('runs in one transaction: a failure in the middle leaves everything as it was', async () => {
      const ana = await newPlayer({ nickname: 'Ana' });
      const feedBefore = (await db.select().from(feedEvents)).length;
      // A check constraint that rejects the new epoch makes the players update fail after the epoch bump.
      await db.execute(sql`alter table players add constraint reset_blocker check (progress_epoch = 0)`);
      try {
        await expect(resetForLaunch(db, LAUNCH_RESET_PHRASE, T0)).rejects.toThrow();
        expect(await readProgressEpoch(db)).toBe(0);
        const [row] = await db.select().from(players).where(eq(players.id, ana.id));
        expect(row?.save).not.toBeNull();
        expect(await db.select().from(feedEvents)).toHaveLength(feedBefore);
        expect(feedBefore).toBeGreaterThan(0);
      } finally {
        await db.execute(sql`alter table players drop constraint reset_blocker`);
      }
    });
  });

  describe('the progress epoch', () => {
    it('lets a device that sends no epoch (an old client) sync as before the reset', async () => {
      const [first] = savesOf(1);
      const created = await syncPlayer(db, { request: body(first!, 0), token: null, ip: '10.0.0.1', now: T0 });
      expect(created.body.status).toBe('ok');
    });

    it('refuses a save from before the reset, writes nothing and leaves the board clean', async () => {
      const ana = await newPlayer({ nickname: 'Ana' });
      await resetForLaunch(db, LAUNCH_RESET_PHRASE, T0 + 60 * 60_000);

      // The returning tester: epoch 0 (or none), a full old save, the revision it had.
      for (const epoch of [0, undefined]) {
        const stale = await syncPlayer(db, {
          request: body(ana.last, ana.rev, epoch),
          token: ana.token,
          ip: '10.0.0.1',
          now: T0 + 2 * 60 * 60_000,
        });
        expect(stale.body).toMatchObject({ status: 'reset', epoch: 1, me: { nickname: 'Ana' } });
      }
      // Even forced.
      const forced = await syncPlayer(db, {
        request: { ...body(ana.last, 0, 0), force: true },
        token: ana.token,
        ip: '10.0.0.1',
        now: T0 + 2 * 60 * 60_000 + 1,
      });
      expect(forced.body.status).toBe('reset');

      const [row] = await db.select().from(players).where(eq(players.id, ana.id));
      expect(row).toMatchObject({ save: null, rev: 0, lifetimeCoinsText: '0', diplomasEarned: 0, achievements: 0 });
      const board = await getLeaderboard(db, 'coins', T0 + 3 * 60 * 60_000);
      expect(board.entries[0]).toMatchObject({ nickname: 'Ana', value: '0' });
      expect((await getRanks(db, row!)).ranks.coins).toBe(1);
    });

    it('takes progress again once the device carries the new epoch, from a fresh game', async () => {
      const ana = await newPlayer({ nickname: 'Ana' });
      await resetForLaunch(db, LAUNCH_RESET_PHRASE, T0 + 60 * 60_000);
      const me = await getMe(db, ana.headers, T0 + 2 * 60 * 60_000);
      expect(me.body.epoch).toBe(1);

      const [fresh] = savesOf(1, 5);
      const accepted = await syncPlayer(db, {
        request: body(fresh!, 0, me.body.epoch),
        token: ana.token,
        ip: '10.0.0.1',
        now: T0 + 2 * 60 * 60_000,
      });
      expect(accepted.body).toMatchObject({ status: 'ok', rev: 1 });
      const [row] = await db.select().from(players).where(eq(players.id, ana.id));
      expect(row?.lifetimeCoinsText).toBe(fresh!.lifetimeCoins.toString());
    });

    it('creates a guest after the reset at the current epoch, and tells a device without a session the epoch', async () => {
      await resetForLaunch(db, LAUNCH_RESET_PHRASE, T0);
      const anonymous = await getMe(db, new Headers(), T0 + 1);
      expect(anonymous.body).toMatchObject({ me: null, epoch: 1 });

      const [first] = savesOf(1);
      const created = await syncPlayer(db, { request: body(first!, 0, 1), token: null, ip: '10.0.0.1', now: T0 + 2 });
      expect(created.body.status).toBe('ok');
      // The same save from a device that never learned the epoch is a pre-reset save: refused.
      const stale = await syncPlayer(db, { request: body(first!, 0, 0), token: null, ip: '10.0.0.2', now: T0 + 3 });
      expect(stale.body.status).toBe('reset');
    });
  });
});
