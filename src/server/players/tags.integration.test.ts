/**
 * Tags (the catalogue, giving and showing them), the bulk "Turma Zero" grant and the progress epoch, against Postgres
 * (`adsclicker_titles_test`). Skips itself when the database cannot be reached, like the other
 * integration tests.
 */
import { readFileSync } from 'node:fs';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { serializeState } from '@/game/engine';
import type { GameState } from '@/game/engine/state';
import { adminPlayerPatchSchema } from '@/shared/api';
import { PLATINADO_TAG, PLATINA_ACHIEVEMENT } from '@/shared/tags';
import type { SyncRequest } from '@/shared/api';
import { formatNumber } from '@/game/engine';
import { playerStats } from '../admin/playerStats';
import { listPlayers, patchPlayer } from '../admin/players';
import { requireSession } from '../auth/context';
import { SESSION_COOKIE, readSessionToken } from '../auth/session';
import { clearCommunityCache, getCommunity } from '../community/community';
import { clearLeaderboardCache, getLeaderboard, getRanks } from '../community/leaderboard';
import { resetEventMultiplierCache } from '../config/eventMultiplier';
import {
  feedEvents,
  players,
} from '../db/schema';
import { ApiFailure } from '../http/errors';
import { setNickname } from './account';
import { getMe } from './me';
import { syncPlayer } from './sync';
import { clearTagCache, createTag, deleteTag, grantTurmaZeroToAll, listAdminTags, turmaZeroPreview, updateTag } from './tags';
import { logEvent } from '../logs/log';
import { connectTestDb } from '../testing/db';
import { playWindows } from '../testing/play';

vi.mock('../logs/log', async (importOriginal) => ({ ...(await importOriginal<typeof import('../logs/log')>()), logEvent: vi.fn() }));

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

describe.skipIf(!testDb)('tags and the progress epoch against Postgres', () => {
  if (!testDb) return;
  const { db } = testDb;

  beforeEach(async () => {
    await testDb.reset();
    vi.mocked(logEvent).mockClear();
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

  describe('the Platinado tag', () => {
    /** The migration that seeds the tag (the test database is reset to the two launch tags between tests). */
    const seedPlatinado = () => db.execute(sql.raw(readFileSync('drizzle/0006_platinado_tag.sql', 'utf8')));

    /** Syncs `state` with the Platina achievement for a player who already synced, and returns the answer. */
    async function earnPlatina(player: Awaited<ReturnType<typeof newPlayer>>, ip = '10.0.0.1') {
      const state = player.last;
      state.achievements[PLATINA_ACHIEVEMENT] = player.now;
      const result = await syncPlayer(db, { request: body(state, player.rev, 0), token: player.token, ip, now: player.now });
      if (result.body.status !== 'ok') throw new Error(`unexpected ${result.body.status}`);
      return { result: result.body, now: player.now + 45_000 };
    }

    /** The event log is switched off under test, so the calls to it are what is checked. */
    const platinadoLogs = () => vi.mocked(logEvent).mock.calls.map((call) => call[1]).filter((entry) => entry.kind === 'tag_platinado');

    const titlesOf = async (id: string) => (await db.select({ titles: players.titles }).from(players).where(eq(players.id, id)))[0]?.titles ?? [];

    it('is seeded by the migration, last in priority, and the seed can run twice', async () => {
      await seedPlatinado();
      await seedPlatinado();
      const tags = await listAdminTags(db);
      expect(tags.tags.map((tag) => tag.id)).toEqual(['primeiro-platinado', 'turma-zero', PLATINADO_TAG]);
      expect(tags.tags[2]).toMatchObject({ label: '💎 Platinado', visibility: 'public', single: false });
    });

    it('is given to a ranked player with the Platina achievement, once, and logged', async () => {
      await seedPlatinado();
      const ana = await newPlayer({ nickname: 'Ana' });
      expect(await titlesOf(ana.id)).toEqual([]);

      const first = await earnPlatina(ana);
      expect(await titlesOf(ana.id)).toEqual([PLATINADO_TAG]);
      expect(first.result.me.tags?.map((tag) => tag.id)).toEqual([PLATINADO_TAG]);
      expect(platinadoLogs()).toEqual([expect.objectContaining({ kind: 'tag_platinado', playerId: ana.id, nickname: 'Ana' })]);

      // The next sync holds it already: nothing is added or logged again.
      const again = await syncPlayer(db, { request: body(ana.last, first.result.status === 'ok' ? first.result.rev : 0, 0), token: ana.token, ip: '10.0.0.1', now: first.now });
      expect(again.body.status).toBe('ok');
      expect(await titlesOf(ana.id)).toEqual([PLATINADO_TAG]);
      expect(platinadoLogs()).toHaveLength(1);

      // It shows on the board like any public tag, and Primeiro Platinado is a separate, untouched tag.
      await patchPlayer(db, ana.id, { grantTag: 'primeiro-platinado' }, null);
      const entry = (await getLeaderboard(db, 'coins', T0)).entries.find((row) => row.nickname === 'Ana');
      expect(entry?.tags?.map((tag) => tag.id)).toEqual(['primeiro-platinado', PLATINADO_TAG]);
    });

    it('is not given without the achievement, to an unranked account, or when the tag was deleted', async () => {
      await seedPlatinado();
      const plain = await newPlayer({ nickname: 'Ana' });
      const synced = await syncPlayer(db, { request: body(plain.last, plain.rev, 0), token: plain.token, ip: '10.0.0.1', now: plain.now });
      expect(synced.body.status).toBe('ok');
      expect(await titlesOf(plain.id)).toEqual([]);

      const guest = await newPlayer({ seed: 2, ip: '10.0.0.2' });
      await earnPlatina(guest, '10.0.0.2');
      expect(await titlesOf(guest.id)).toEqual([]);

      const banned = await newPlayer({ nickname: 'Bia', seed: 3, ip: '10.0.0.3' });
      await db.update(players).set({ banned: true }).where(eq(players.id, banned.id));
      await earnPlatina(banned, '10.0.0.3');
      expect(await titlesOf(banned.id)).toEqual([]);

      const test = await newPlayer({ nickname: 'Caio', seed: 4, ip: '10.0.0.4' });
      await db.update(players).set({ testAccount: true }).where(eq(players.id, test.id));
      await earnPlatina(test, '10.0.0.4');
      expect(await titlesOf(test.id)).toEqual([]);

      await deleteTag(db, PLATINADO_TAG);
      const late = await newPlayer({ nickname: 'Duda', seed: 5, ip: '10.0.0.5' });
      await earnPlatina(late, '10.0.0.5');
      expect(await titlesOf(late.id)).toEqual([]);
    });

    it('is given on the first sync after the account becomes ranked', async () => {
      await seedPlatinado();
      const guest = await newPlayer({ seed: 6, ip: '10.0.0.6' });
      const earned = await earnPlatina(guest, '10.0.0.6');
      expect(await titlesOf(guest.id)).toEqual([]);
      await setNickname(db, await requireSession(db, guest.headers, earned.now), { nickname: 'Eva', password: 'senha-padrao' }, earned.now);
      clearTagCache();
      const rev = earned.result.status === 'ok' ? earned.result.rev : 0;
      await syncPlayer(db, { request: body(guest.last, rev, 0), token: guest.token, ip: '10.0.0.6', now: earned.now });
      expect(await titlesOf(guest.id)).toEqual([PLATINADO_TAG]);
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

  describe('the progress epoch', () => {
    /**
     * The state the one-time launch reset left in production (the code that did it is gone): the counter at 1 and every
     * account at epoch 1 with its progress blank. Written straight into the tables.
     */
    async function moveToEpochOne() {
      await db.execute(sql`insert into app_config (key, value, updated_at) values ('progress_epoch', to_jsonb(1), now())
        on conflict (key) do update set value = to_jsonb(1)`);
      await db.execute(sql`update players set progress_epoch = 1, save = null, rev = 0, lifetime_coins_text = '0',
        lifetime_coins = 0, lifetime_coins_log = 0, diplomas_earned = 0, graduations = 0, clicks = 0, achievements = 0`);
    }
    it('lets a device that sends no epoch (an old client) sync as before the reset', async () => {
      const [first] = savesOf(1);
      const created = await syncPlayer(db, { request: body(first!, 0), token: null, ip: '10.0.0.1', now: T0 });
      expect(created.body.status).toBe('ok');
    });

    it('refuses a save from before the reset, writes nothing and leaves the board clean', async () => {
      const ana = await newPlayer({ nickname: 'Ana' });
      await moveToEpochOne();

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
      await moveToEpochOne();
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
      await moveToEpochOne();
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
