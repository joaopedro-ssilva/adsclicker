/**
 * Tags (the catalogue, giving and showing them), the bulk "Turma Zero" grant, the launch reset and the progress epoch, against Postgres
 * (`adsclicker_titles_test`). Skips itself when the database cannot be reached, like the other
 * integration tests.
 */
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { serializeState } from '@/game/engine';
import type { GameState } from '@/game/engine/state';
import { LAUNCH_RESET_PHRASE, adminPlayerPatchSchema } from '@/shared/api';
import type { SyncRequest } from '@/shared/api';
import { formatNumber } from '@/game/engine';
import { playerStats } from '../admin/playerStats';
import { listPlayers, patchPlayer } from '../admin/players';
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
import { clearTagCache, createTag, deleteTag, grantTurmaZeroToAll, listAdminTags, turmaZeroPreview, updateTag } from './tags';
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

describe.skipIf(!testDb)('tags and launch reset against Postgres', () => {
  if (!testDb) return;
  const { db } = testDb;

  beforeEach(async () => {
    await testDb.reset();
    clearCommunityCache();
    clearLeaderboardCache();
    clearTagCache();
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

  describe('giving and taking a tag', () => {
    it('gives and takes one tag, and repeating either changes nothing', async () => {
      const ana = await newPlayer({ nickname: 'Ana' });
      const granted = await patchPlayer(db, ana.id, { grantTag: 'turma-zero' }, null);
      expect(granted.player.tags).toEqual(['turma-zero']);
      const again = await patchPlayer(db, ana.id, { grantTag: 'turma-zero' }, null);
      expect(again.player.tags).toEqual(['turma-zero']);

      const both = await patchPlayer(db, ana.id, { grantTag: 'primeiro-platinado' }, null);
      // Highest priority first.
      expect(both.player.tags).toEqual(['primeiro-platinado', 'turma-zero']);

      const removed = await patchPlayer(db, ana.id, { revokeTag: 'turma-zero' }, null);
      expect(removed.player.tags).toEqual(['primeiro-platinado']);
      const removedAgain = await patchPlayer(db, ana.id, { revokeTag: 'turma-zero' }, null);
      expect(removedAgain.player.tags).toEqual(['primeiro-platinado']);
    });

    it('does not let a single-holder tag go to a second player, until the first one loses it', async () => {
      const ana = await newPlayer({ nickname: 'Ana', ip: '10.0.0.1' });
      const bia = await newPlayer({ nickname: 'Bia', seed: 2, ip: '10.0.0.2' });
      await patchPlayer(db, ana.id, { grantTag: 'primeiro-platinado' }, null);
      const failure = await expectFailure(patchPlayer(db, bia.id, { grantTag: 'primeiro-platinado' }, null), 'invalid');
      expect(failure.message).toContain('Ana');
      await patchPlayer(db, ana.id, { revokeTag: 'primeiro-platinado' }, null);
      const moved = await patchPlayer(db, bia.id, { grantTag: 'primeiro-platinado' }, null);
      expect(moved.player.tags).toEqual(['primeiro-platinado']);
    });

    it('refuses giving and taking in the same call, and refuses a tag that does not exist', async () => {
      const ana = await newPlayer({ nickname: 'Ana' });
      await expectFailure(patchPlayer(db, ana.id, { grantTag: 'turma-zero', revokeTag: 'turma-zero' }, null), 'invalid');
      await expectFailure(patchPlayer(db, ana.id, { grantTag: 'rei-do-clicker' }, null), 'invalid');
      expect(adminPlayerPatchSchema.safeParse({ grantTag: '' }).success).toBe(false);
      expect(adminPlayerPatchSchema.safeParse({ grantTag: 'turma-zero' }).success).toBe(true);
    });
  });

  describe('showing tags', () => {
    it('puts them on the board entries, the feed and the player\'s own answer, highest priority first', async () => {
      const ana = await newPlayer({ nickname: 'Ana' });
      const bia = await newPlayer({ nickname: 'Bia', seed: 2, ip: '10.0.0.2' });
      await patchPlayer(db, ana.id, { grantTag: 'turma-zero' }, null);
      await patchPlayer(db, ana.id, { grantTag: 'primeiro-platinado' }, null);
      await db.insert(feedEvents).values({ playerId: ana.id, kind: 'hire', detail: 'angelo' });
      await db.insert(feedEvents).values({ playerId: bia.id, kind: 'hire', detail: 'angelo' });

      const board = await getLeaderboard(db, 'coins', T0);
      const byName = new Map(board.entries.map((entry) => [entry.nickname, entry]));
      expect(byName.get('Ana')?.tags).toEqual([
        { id: 'primeiro-platinado', label: 'Primeiro Platinado', description: 'O primeiro jogador a conquistar todas as conquistas.', color: '#f2c744' },
        { id: 'turma-zero', label: 'Turma Zero', description: 'Jogou na fase de testes, antes do lançamento oficial.', color: '#6fd6e6' },
      ]);
      // A player without tags adds nothing to the payload.
      expect(byName.get('Bia')).not.toHaveProperty('tags');

      const community = await getCommunity(db, T0);
      expect(community.feed.find((item) => item.nickname === 'Ana')?.tags?.map((tag) => tag.id)).toEqual(['primeiro-platinado', 'turma-zero']);
      expect(community.feed.find((item) => item.nickname === 'Bia')).not.toHaveProperty('tags');

      const me = await getMe(db, ana.headers, T0 + 10 * 60_000);
      expect(me.body.me?.tags?.map((tag) => tag.id)).toEqual(['primeiro-platinado', 'turma-zero']);
    });

    it('keeps admin-only tags off the boards, the feed and the player\'s own answer, but lists them on /admin', async () => {
      const ana = await newPlayer({ nickname: 'Ana' });
      const { tag: watch } = await createTag(db, { label: 'De olho', color: '#ff6b6b', visibility: 'admin' });
      await patchPlayer(db, ana.id, { grantTag: watch.id }, null);
      await patchPlayer(db, ana.id, { grantTag: 'turma-zero' }, null);
      await db.insert(feedEvents).values({ playerId: ana.id, kind: 'hire', detail: 'angelo' });

      const entry = (await getLeaderboard(db, 'coins', T0)).entries.find((row) => row.nickname === 'Ana');
      expect(entry?.tags?.map((tag) => tag.id)).toEqual(['turma-zero']);
      expect((await getCommunity(db, T0)).feed[0]?.tags?.map((tag) => tag.id)).toEqual(['turma-zero']);
      expect((await getMe(db, ana.headers, T0 + 10 * 60_000)).body.me?.tags?.map((tag) => tag.id)).toEqual(['turma-zero']);

      const listed = await listPlayers(db, { search: 'Ana', page: 1, selfId: null }, T0);
      expect(listed.players[0]?.tags).toEqual(['turma-zero', watch.id]);

      // Turning it public shows it at once on this instance (the catalogue cache is cleared by the change).
      await updateTag(db, watch.id, { visibility: 'public' });
      clearLeaderboardCache();
      const shown = (await getLeaderboard(db, 'coins', T0 + 1)).entries.find((row) => row.nickname === 'Ana');
      expect(shown?.tags?.map((tag) => tag.id)).toEqual(['turma-zero', watch.id]);
    });
  });

  describe('the tag catalogue', () => {
    it('creates tags with readable ids, last in priority, and counts who holds each one', async () => {
      const first = await createTag(db, { label: 'Campeão do Semestre', description: 'Venceu o semestre.', color: '#b48cff', visibility: 'public' });
      expect(first.tag).toEqual({
        id: 'campeao-do-semestre',
        label: 'Campeão do Semestre',
        description: 'Venceu o semestre.',
        color: '#b48cff',
        visibility: 'public',
        single: false,
        holders: 0,
      });
      const again = await createTag(db, { label: 'Campeão do semestre!', color: '#b48cff', visibility: 'admin', single: true });
      expect(again.tag).toMatchObject({ id: 'campeao-do-semestre-2', visibility: 'admin', single: true, description: '' });

      const ana = await newPlayer({ nickname: 'Ana' });
      await patchPlayer(db, ana.id, { grantTag: first.tag.id }, null);
      const { tags } = await listAdminTags(db);
      expect(tags.map((tag) => [tag.id, tag.holders])).toEqual([
        ['primeiro-platinado', 0],
        ['turma-zero', 0],
        ['campeao-do-semestre', 1],
        ['campeao-do-semestre-2', 0],
      ]);
    });

    it('edits name, description, colour and visibility, and refuses making single a tag two players hold', async () => {
      const ana = await newPlayer({ nickname: 'Ana', ip: '10.0.0.1' });
      const bia = await newPlayer({ nickname: 'Bia', seed: 2, ip: '10.0.0.2' });
      const edited = await updateTag(db, 'turma-zero', { label: 'Turma Zero!', description: 'Pioneiros.', color: '#7bd88f', visibility: 'admin' });
      expect(edited.tag).toMatchObject({ id: 'turma-zero', label: 'Turma Zero!', description: 'Pioneiros.', color: '#7bd88f', visibility: 'admin' });

      await patchPlayer(db, ana.id, { grantTag: 'turma-zero' }, null);
      await patchPlayer(db, bia.id, { grantTag: 'turma-zero' }, null);
      const refused = await expectFailure(updateTag(db, 'turma-zero', { single: true }), 'invalid');
      expect(refused.message).toContain('2 jogadores');
      await patchPlayer(db, bia.id, { revokeTag: 'turma-zero' }, null);
      expect((await updateTag(db, 'turma-zero', { single: true })).tag).toMatchObject({ single: true, holders: 1 });
      await expectFailure(updateTag(db, 'nao-existe', { label: 'x' }), 'invalid');
    });

    it('deletes a tag and takes it from every player in the same step', async () => {
      const ana = await newPlayer({ nickname: 'Ana', ip: '10.0.0.1' });
      const bia = await newPlayer({ nickname: 'Bia', seed: 2, ip: '10.0.0.2' });
      const { tag } = await createTag(db, { label: 'Veterano', color: '#ff9f43', visibility: 'public' });
      await patchPlayer(db, ana.id, { grantTag: tag.id }, null);
      await patchPlayer(db, bia.id, { grantTag: tag.id }, null);
      await patchPlayer(db, bia.id, { grantTag: 'turma-zero' }, null);

      expect(await deleteTag(db, tag.id)).toEqual({ removedFrom: 2 });
      const rows = await db.select({ nickname: players.nickname, titles: players.titles }).from(players);
      expect(Object.fromEntries(rows.map((row) => [row.nickname, row.titles]))).toEqual({ Ana: [], Bia: ['turma-zero'] });
      expect((await listAdminTags(db)).tags.map((row) => row.id)).toEqual(['primeiro-platinado', 'turma-zero']);
      await expectFailure(deleteTag(db, tag.id), 'invalid');
      // Taking away a deleted tag is harmless.
      expect((await patchPlayer(db, ana.id, { revokeTag: tag.id }, null)).player.tags).toEqual([]);
    });

    it('turns the Turma Zero tools off when that tag is deleted', async () => {
      await newPlayer({ nickname: 'Ana' });
      await deleteTag(db, 'turma-zero');
      await expectFailure(turmaZeroPreview(db), 'invalid');
      await expectFailure(grantTurmaZeroToAll(db), 'invalid');
      expect((await previewLaunchReset(db)).withoutTurmaZero).toBe(0);
    });
  });

  describe('a player\'s statistics on /admin', () => {
    it('reads the account and the cloud save', async () => {
      const ana = await newPlayer({ nickname: 'Ana', windows: 4 });
      const stats = await playerStats(db, ana.id, ana.now);
      expect(stats.hasSave).toBe(true);
      const section = (title: string) => stats.sections.find((entry) => entry.title === title);
      const value = (title: string, label: string) => section(title)?.rows.find((row) => row.label === label)?.value;
      expect(section('Conta')?.rows.find((row) => row.label === 'Apelido')?.value).toBe('Ana');
      expect(value('Progresso', 'Turmas formadas')).toBe(String(ana.last.counters.graduations));
      expect(value('Contadores', 'Cliques')).toBe(formatNumber(ana.last.counters.clicks, { integer: true }));
      expect(value('Coleção', 'Conquistas')).toMatch(/^\d+ \/ \d+$/);
      expect(section('Conta')?.rows.find((row) => row.label === 'Criada em')?.at).toEqual(expect.any(Number));
    });

    it('shows only the account for a player who never synced, and refuses unknown ids', async () => {
      const [row] = await db.insert(players).values({ nickname: 'Cris', nicknameKey: 'cris' }).returning({ id: players.id });
      const stats = await playerStats(db, row!.id, T0);
      expect(stats).toMatchObject({ hasSave: false });
      expect(stats.sections.map((section) => section.title)).toEqual(['Conta']);
      await expectFailure(playerStats(db, '00000000-0000-4000-8000-000000000000', T0), 'not_found');
      await expectFailure(playerStats(db, 'nao-e-uuid', T0), 'not_found');
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

    it('keeps the other tags a player already holds', async () => {
      const ana = await newPlayer({ nickname: 'Ana' });
      await patchPlayer(db, ana.id, { grantTag: 'primeiro-platinado' }, null);
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

    it('clears progress, flags, boards, totals, feed and Hackathon, and keeps accounts, passwords, sessions and tags', async () => {
      const ana = await newPlayer({ nickname: 'Ana', ip: '10.0.0.1' });
      const bia = await newPlayer({ nickname: 'Bia', seed: 2, ip: '10.0.0.2' });
      await patchPlayer(db, ana.id, { grantTag: 'turma-zero' }, null);
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
      expect(logged.body.me.tags?.map((tag) => tag.id)).toEqual(['turma-zero']);
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
