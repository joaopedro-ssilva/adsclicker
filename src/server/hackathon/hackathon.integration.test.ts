/**
 * Hackathon services against Postgres (`adsclicker_test`), with the scripted engine of fixtures.ts.
 * Skips itself when the database cannot be reached, like the rest of the integration tests.
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { content as gameContent } from '@/game/content';
import { createInitialState, serializeState } from '@/game/engine';
import type { GameState } from '@/game/engine/state';
import type { ItemInstance } from '@/hackathon/engine/types';
import { createFake, fixtureContent } from './fixtures';
import type { FakeHackathon } from './fixtures';
import type { SyncRequest } from '@/shared/api';
import { requireSession } from '../auth/context';
import { login } from '../auth/login';
import { SESSION_COOKIE, readSessionToken } from '../auth/session';
import { clearCommunityCache, getCommunity } from '../community/community';
import { clearLeaderboardCache, getLeaderboard } from '../community/leaderboard';
import { resetEventMultiplierCache } from '../config/eventMultiplier';
import { feedEvents, hackathonItems, hackathonProfiles, hackathonRuns, hackathonStages } from '../db/schema';
import { ApiFailure } from '../http/errors';
import { setNickname } from '../players/account';
import { getMe } from '../players/me';
import { syncPlayer } from '../players/sync';
import { connectTestDb } from '../testing/db';
import { roundTrip } from '../testing/play';
import type { HackathonContext } from './context';
import { equipItem, manageItems, manageSkills, buyMentorLevel } from './manage';
import { getProfile, saveProfile } from './profile';
import { finishRun, startRun } from './run';
import { itemToRow } from './store';

// Its own database: test files run in parallel and each one truncates its tables.
const testDb = await connectTestDb({ database: 'adsclicker_hackathon_test' });
afterAll(async () => {
  await testDb?.close();
});

const MINUTE = 60_000;
/** 12:00 in São Paulo. */
const T0 = Date.UTC(2026, 9, 2, 15, 0, 0);

async function expectFailure(promise: Promise<unknown>, code: string): Promise<ApiFailure> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(ApiFailure);
  expect((error as ApiFailure).code).toBe(code);
  return error as ApiFailure;
}

function saveOf(options: { hired?: string[]; achievements?: string[]; cafesBought?: number; graduations?: number } = {}): GameState {
  const state = roundTrip(createInitialState(gameContent, T0));
  for (const id of options.hired ?? ['b2']) (state.hired as Record<string, boolean>)[id] = true;
  for (const id of options.achievements ?? []) state.achievements[id] = T0;
  state.counters.cafesBought = options.cafesBought ?? 0;
  state.counters.graduations = options.graduations ?? 0;
  return state;
}

describe.skipIf(!testDb)('Hackathon against Postgres', () => {
  if (!testDb) return;
  const { db } = testDb;
  let fake: FakeHackathon;

  beforeEach(async () => {
    await testDb.reset();
    clearCommunityCache();
    clearLeaderboardCache();
    resetEventMultiplierCache();
    fake = createFake();
  });

  interface Browser {
    headers: Headers;
    token: string;
    id: string;
    rev: number;
    nickname: string | null;
  }

  /** A player whose cloud save is `state`, created by the real first sync. */
  async function newPlayer(
    options: { state?: GameState; nickname?: string; ip?: string; deps?: FakeHackathon['deps'] } = {},
  ): Promise<Browser> {
    const request: SyncRequest = { save: serializeState(options.state ?? saveOf()), baseRev: 0 };
    const result = await syncPlayer(db, {
      request,
      token: null,
      ip: options.ip ?? '10.0.0.1',
      now: T0,
      hackathon: options.deps ?? fake.deps,
    });
    if (result.body.status !== 'ok') throw new Error('unexpected conflict');
    const cookie = result.cookies.find((entry) => entry.startsWith(`${SESSION_COOKIE}=`))?.split(';')[0] ?? '';
    const headers = new Headers({ cookie });
    const token = readSessionToken(headers);
    if (!token) throw new Error('no session');
    const browser: Browser = { headers, token, id: result.body.me.id, rev: result.body.rev, nickname: null };
    if (options.nickname) {
      await setNickname(db, await requireSession(db, headers, T0), { nickname: options.nickname, password: 'segredo123' }, T0);
      browser.nickname = options.nickname;
    }
    return browser;
  }

  async function ctxOf(browser: Browser, now = T0, deps = fake.deps): Promise<HackathonContext> {
    const { player } = await requireSession(db, browser.headers, now);
    return { db, player, deps, now };
  }

  /** A player with an unlocked mode and a created student. */
  async function newStudent(options: { nickname?: string; ip?: string } = {}): Promise<Browser> {
    const browser = await newPlayer(options);
    await saveProfile(await ctxOf(browser), { head: 'h1' });
    return browser;
  }

  const patchProfile = (browser: Browser, patch: Partial<typeof hackathonProfiles.$inferInsert>) =>
    db.update(hackathonProfiles).set(patch).where(eq(hackathonProfiles.playerId, browser.id));

  const profileRow = async (browser: Browser) => {
    const [row] = await db.select().from(hackathonProfiles).where(eq(hackathonProfiles.playerId, browser.id));
    if (!row) throw new Error('no profile');
    return row;
  };

  async function giveItem(browser: Browser, base = 'tool-a', rarity: ItemInstance['rarity'] = 'comum', id?: string): Promise<ItemInstance> {
    const item: ItemInstance = {
      id: id ?? fake.deps.newId(),
      base,
      rarity,
      level: 1,
      affixes: [
        { target: 'logica', op: 'add', value: 5, quality: 50 },
        { target: 'foco', op: 'add', value: 3, quality: 50 },
      ],
      quality: 50,
      rerolls: 0,
      createdAt: T0,
    };
    await db.insert(hackathonItems).values(itemToRow(browser.id, item));
    return item;
  }

  /** Starts and finishes one stage a minute later; returns the finish response. */
  async function play(browser: Browser, stageId: string, at: number) {
    const started = await startRun(await ctxOf(browser, at), { stageId, auto: false });
    return finishRun(await ctxOf(browser, at + MINUTE), { runId: started.runId, actions: [] });
  }

  describe('profile', () => {
    it('stays locked until the cloud save shows Bruna B2 hired, with a clear reason', async () => {
      const guest = await newPlayer({ state: saveOf({ hired: ['gladimir'] }) });
      const closed = await getProfile(await ctxOf(guest));
      expect(closed).toMatchObject({ unlocked: false, profile: null });
      expect(closed.lockReason).toMatch(/Bruna B2/);
      await expectFailure(saveProfile(await ctxOf(guest), { head: 'h1' }), 'forbidden');
    });

    it('is locked for an account that never synced a save', async () => {
      const lonely = await newPlayer();
      await db.execute((await import('drizzle-orm')).sql`update players set save = null`);
      const result = await getProfile(await ctxOf(lonely));
      expect(result.unlocked).toBe(false);
      expect(result.lockReason).toMatch(/online/);
    });

    it('opens once B2 was hired at some point (the achievement), even if not hired now', async () => {
      const browser = await newPlayer({ state: saveOf({ hired: [], achievements: ['hire-b2'] }) });
      expect(await getProfile(await ctxOf(browser))).toMatchObject({ unlocked: true, lockReason: null, profile: null });
    });

    it('creates an Estudante at level 1 with full Café, and builds the whole response', async () => {
      const browser = await newPlayer();
      const { profile } = await saveProfile(await ctxOf(browser), { head: 'h2' });
      expect(profile).toMatchObject({
        head: 'h2',
        cargo: 'estudante',
        level: 1,
        xp: 0,
        commits: 0,
        cafe: { count: 3, max: 3, nextAt: null },
        freeSkillPoints: 0,
        activeSkills: [],
        pity: 0,
        items: [],
        collection: [],
        daily: { dateKey: '2026-10-02', clears: 0 },
        totals: { victories: 0, defeats: 0, itemsFound: 0, legendaries: 0 },
      });
      expect(profile.xpToNext).toBe(100);
      expect(profile.equipped).toEqual({ ferramenta: null, setup: null, acessorio: null, amuleto: null });
      expect(profile.mentors.edecio).toEqual({ level: 0, unlocked: true });
      expect(profile.mentors.b2).toEqual({ level: 0, unlocked: true });
      expect(profile.mentors.wagner).toEqual({ level: 0, unlocked: false });
      expect(profile.build.stats.logica).toBeGreaterThan(0);
    });

    it('refuses an unknown head, and a repeated creation only changes the head', async () => {
      const browser = await newPlayer();
      await expectFailure(saveProfile(await ctxOf(browser), { head: 'nope' }), 'invalid');
      await saveProfile(await ctxOf(browser), { head: 'h1' });
      await patchProfile(browser, { level: 2, commits: 77 });
      const again = await Promise.all([
        saveProfile(await ctxOf(browser), { head: 'h2' }),
        saveProfile(await ctxOf(browser), { head: 'h2' }),
      ]);
      expect(again[0].profile).toMatchObject({ head: 'h2', level: 2, commits: 77 });
      expect(await db.select().from(hackathonProfiles)).toHaveLength(1);
    });

    it('answers unavailable while the engine or content are placeholders', async () => {
      const browser = await newPlayer();
      const notReady = { ...fake.deps, content: { ...fixtureContent, stages: [] } };
      await expectFailure(getProfile(await ctxOf(browser, T0, notReady)), 'unavailable');
      await expectFailure(startRun(await ctxOf(browser, T0, notReady), { stageId: 's1', auto: false }), 'unavailable');
      const throwing = {
        ...fake.deps,
        engine: {
          ...fake.deps.engine,
          xpToNext: () => {
            throw new Error('hackathon engine: xpToNext is not implemented yet');
          },
        },
      };
      await expectFailure(getProfile(await ctxOf(browser, T0, throwing)), 'unavailable');
    });
  });

  describe('run start', () => {
    it('spends one Café, stores the snapshot and answers with seed, build and stage', async () => {
      const browser = await newStudent();
      const started = await startRun(await ctxOf(browser), { stageId: 's1', auto: true });
      expect(started.auto).toBe(true);
      expect(Number.isInteger(started.seed)).toBe(true);
      expect(started.stage.id).toBe('s1');
      expect(started.profile.cafe).toMatchObject({ count: 2, nextAt: T0 + 10 * MINUTE });
      const [run] = await db.select().from(hackathonRuns);
      expect(run).toMatchObject({ id: started.runId, playerId: browser.id, stageId: 's1', status: 'open', seed: started.seed, auto: true });
      expect(run!.build).toEqual(started.build);
      expect(run!.stage).toEqual(started.stage);
    });

    it('regenerates Café with the passing of time, computed lazily', async () => {
      const browser = await newStudent();
      for (let i = 0; i < 3; i += 1) await startRun(await ctxOf(browser), { stageId: 's1', auto: false });
      await expectFailure(startRun(await ctxOf(browser, T0 + 9 * MINUTE), { stageId: 's1', auto: false }), 'forbidden');
      const later = await startRun(await ctxOf(browser, T0 + 25 * MINUTE), { stageId: 's1', auto: false });
      expect(later.profile.cafe.count).toBe(1);
    });

    it('refuses a locked stage and an unknown one, and spends nothing when it refuses', async () => {
      const browser = await newStudent();
      const locked = await expectFailure(startRun(await ctxOf(browser), { stageId: 's2', auto: false }), 'forbidden');
      expect(locked.message).toMatch(/nível 2/);
      await expectFailure(startRun(await ctxOf(browser), { stageId: 'nope', auto: false }), 'not_found');
      expect((await profileRow(browser)).cafeCount).toBe(3);
      expect(await db.select().from(hackathonRuns)).toHaveLength(0);
    });

    it('needs the previous stage won, not just the level', async () => {
      const browser = await newStudent();
      await patchProfile(browser, { level: 2 });
      const failure = await expectFailure(startRun(await ctxOf(browser), { stageId: 's2', auto: false }), 'forbidden');
      expect(failure.message).toMatch(/Fase s1/);
      await db.insert(hackathonStages).values({ playerId: browser.id, stageId: 's1', clears: 1 });
      await startRun(await ctxOf(browser), { stageId: 's2', auto: false });
    });

    it('refuses without Café', async () => {
      const browser = await newStudent();
      await patchProfile(browser, { cafeCount: 0, cafeAt: new Date(T0) });
      const failure = await expectFailure(startRun(await ctxOf(browser), { stageId: 's1', auto: false }), 'forbidden');
      expect(failure.message).toMatch(/Café/);
    });

    it('abandons the previous open run, which can then no longer be finished', async () => {
      const browser = await newStudent();
      const first = await startRun(await ctxOf(browser), { stageId: 's1', auto: false });
      const second = await startRun(await ctxOf(browser, T0 + 1000), { stageId: 's1', auto: false });
      const rows = await db.select().from(hackathonRuns);
      expect(rows.find((row) => row.id === first.runId)?.status).toBe('abandoned');
      expect(rows.find((row) => row.id === second.runId)?.status).toBe('open');
      await expectFailure(finishRun(await ctxOf(browser, T0 + MINUTE), { runId: first.runId, actions: [] }), 'forbidden');
    });

    it('resolves the daily stage from the server date in São Paulo', async () => {
      const browser = await newStudent();
      const started = await startRun(await ctxOf(browser), { stageId: 'daily', auto: false });
      expect(started.stage).toMatchObject({ id: 'daily', name: 'Hackathon do dia 2026-10-02' });
      // 01:30 UTC of the next day is still the 2nd in Brazil.
      const late = await startRun(await ctxOf(browser, Date.UTC(2026, 9, 3, 1, 30)), { stageId: 'daily', auto: false });
      expect(late.stage.name).toBe('Hackathon do dia 2026-10-02');
    });

    it('needs a student first', async () => {
      const browser = await newPlayer();
      await expectFailure(startRun(await ctxOf(browser), { stageId: 's1', auto: false }), 'not_found');
    });
  });

  describe('run finish', () => {
    it('pays a win: XP, Commits doubled on the first clear, the drop, progress, collection and totals', async () => {
      const browser = await newStudent();
      const result = await play(browser, 's1', T0);
      expect(result.outcome).toMatchObject({ won: true, reason: 'cleared' });
      expect(result.rewards).toMatchObject({
        xp: 100,
        commits: 80,
        recycledCommits: 0,
        levelsGained: 1,
        promotedTo: null,
        firstClear: true,
      });
      expect(result.rewards.items).toHaveLength(1);
      expect(result.profile).toMatchObject({
        level: 2,
        commits: 80,
        pity: 1,
        collection: ['tool-a'],
        stages: { s1: { clears: 1 } },
        totals: { victories: 1, defeats: 0, itemsFound: 1, legendaries: 0 },
      });
      expect(result.profile.items).toHaveLength(1);
      const second = await play(browser, 's1', T0 + 2 * MINUTE);
      expect(second.rewards).toMatchObject({ commits: 40, firstClear: false });
      expect(second.profile.stages.s1?.clears).toBe(2);
      // Level 2 plus the win unlocked the next stage.
      await startRun(await ctxOf(browser, T0 + 4 * MINUTE), { stageId: 's2', auto: false });
    });

    it('re-simulates with the stored snapshot and the received actions: the server outcome is the truth', async () => {
      const browser = await newStudent();
      fake.script.outcome = { won: false, reason: 'defeated', wavesCleared: 0 };
      const started = await startRun(await ctxOf(browser), { stageId: 's1', auto: false });
      const result = await finishRun(await ctxOf(browser, T0 + MINUTE), {
        runId: started.runId,
        actions: [
          { tick: 3, kind: 'flow' },
          { tick: 9, kind: 'skill', skill: 'sk1' },
        ],
      });
      expect(fake.simulated).toEqual([{ actions: 2, seed: started.seed, stageId: 's1' }]);
      expect(result.outcome.won).toBe(false);
    });

    it('pays only the XP share on a defeat: no Commits, no items, no stage progress', async () => {
      const browser = await newStudent();
      fake.script.outcome = { won: false, reason: 'defeated' };
      const result = await play(browser, 's1', T0);
      expect(result.rewards).toMatchObject({ xp: 30, commits: 0, items: [], firstClear: false, levelsGained: 0 });
      expect(result.profile).toMatchObject({ xp: 30, commits: 0, pity: 0, items: [], stages: {}, totals: { victories: 0, defeats: 1 } });
    });

    it('pays once when the same finish is replayed, even simultaneously', async () => {
      const browser = await newStudent();
      const started = await startRun(await ctxOf(browser), { stageId: 's1', auto: false });
      const body = { runId: started.runId, actions: [] };
      const results = await Promise.allSettled([
        finishRun(await ctxOf(browser, T0 + MINUTE), body),
        finishRun(await ctxOf(browser, T0 + MINUTE), body),
        finishRun(await ctxOf(browser, T0 + MINUTE), body),
      ]);
      expect(results.filter((entry) => entry.status === 'fulfilled')).toHaveLength(1);
      for (const entry of results) if (entry.status === 'rejected') expect((entry.reason as ApiFailure).code).toBe('forbidden');
      await expectFailure(finishRun(await ctxOf(browser, T0 + 2 * MINUTE), body), 'forbidden');
      const row = await profileRow(browser);
      expect(row).toMatchObject({ commits: 80, victories: 1, level: 2 });
      expect(await db.select().from(hackathonItems)).toHaveLength(1);
    });

    it("refuses someone else's run, an unknown run and a malformed id", async () => {
      const owner = await newStudent();
      const thief = await newStudent({ ip: '10.0.0.2' });
      const started = await startRun(await ctxOf(owner), { stageId: 's1', auto: false });
      await expectFailure(finishRun(await ctxOf(thief, T0 + MINUTE), { runId: started.runId, actions: [] }), 'not_found');
      await expectFailure(
        finishRun(await ctxOf(owner, T0 + MINUTE), { runId: '00000000-0000-4000-8000-0000000000ff', actions: [] }),
        'not_found',
      );
      await expectFailure(finishRun(await ctxOf(owner, T0 + MINUTE), { runId: "x'; drop table players;--", actions: [] }), 'not_found');
      expect((await profileRow(thief)).commits).toBe(0);
      // The owner can still finish it.
      await finishRun(await ctxOf(owner, T0 + MINUTE), { runId: started.runId, actions: [] });
    });

    it('refuses an expired run and marks it expired', async () => {
      const browser = await newStudent();
      const started = await startRun(await ctxOf(browser), { stageId: 's1', auto: false });
      await expectFailure(finishRun(await ctxOf(browser, T0 + 31 * MINUTE), { runId: started.runId, actions: [] }), 'forbidden');
      const [run] = await db.select().from(hackathonRuns);
      expect(run?.status).toBe('expired');
      expect((await profileRow(browser)).commits).toBe(0);
    });

    it('counts a finish that is too fast as a defeat with a clear error and pays nothing', async () => {
      const browser = await newStudent();
      fake.script.outcome = { ticks: 1000 }; // 100 s of fight: at least 50 s of real time
      const started = await startRun(await ctxOf(browser), { stageId: 's1', auto: false });
      const failure = await expectFailure(finishRun(await ctxOf(browser, T0 + 10_000), { runId: started.runId, actions: [] }), 'forbidden');
      expect(failure.message).toMatch(/rápida demais/);
      expect(await profileRow(browser)).toMatchObject({ xp: 0, commits: 0, victories: 0, defeats: 1, level: 1 });
      expect(await db.select().from(hackathonItems)).toHaveLength(0);
      await expectFailure(finishRun(await ctxOf(browser, T0 + 5 * MINUTE), { runId: started.runId, actions: [] }), 'forbidden');
    });

    it('recycles drops that do not fit in the inventory into Commits and reports it', async () => {
      const browser = await newStudent();
      await giveItem(browser);
      await giveItem(browser);
      fake.script.drops = [
        { base: 'tool-a', rarity: 'comum' },
        { base: 'setup-a', rarity: 'raro' },
        { base: 'tool-b', rarity: 'epico' },
      ];
      const result = await play(browser, 's1', T0);
      // Room for one: the first is kept, the other two (30 + 40) go to Commits.
      expect(result.rewards.items).toHaveLength(1);
      expect(result.rewards.recycledCommits).toBe(70);
      expect(result.profile.commits).toBe(80 + 70);
      expect(result.profile.items).toHaveLength(3);
      expect(result.profile.collection.sort()).toEqual(['setup-a', 'tool-a', 'tool-b']);
      expect(result.profile.totals.itemsFound).toBe(3);
    });

    it('promotes on the first win of the promotion stage only, and announces it for a ranked player', async () => {
      const browser = await newStudent({ nickname: 'Maria' });
      await patchProfile(browser, { level: 3, cafeCount: 3 });
      await db.insert(hackathonStages).values({ playerId: browser.id, stageId: 's2', clears: 1 });
      const first = await play(browser, 'boss', T0);
      expect(first.rewards.promotedTo).toBe('estagiario');
      expect(first.profile.cargo).toBe('estagiario');
      const second = await play(browser, 'boss', T0 + 2 * MINUTE);
      expect(second.rewards.promotedTo).toBeNull();
      const events = await db.select().from(feedEvents);
      expect(events.filter((event) => event.kind === 'promotion')).toEqual([expect.objectContaining({ detail: 'estagiario' })]);
      clearCommunityCache();
      const community = await getCommunity(db, T0);
      expect(
        community.feed.some((entry) => entry.kind === 'promotion' && entry.detail === 'estagiario' && entry.nickname === 'Maria'),
      ).toBe(true);
    });

    it('announces a legendary drop once per base, only for ranked players, and resets the pity', async () => {
      const ranked = await newStudent({ nickname: 'Joana' });
      const guest = await newStudent({ ip: '10.0.0.3' });
      fake.script.drops = [{ base: 'tool-a', rarity: 'lendario' }];
      await patchProfile(ranked, { pity: 12 });
      const win = await play(ranked, 's1', T0);
      expect(win.profile).toMatchObject({ pity: 0, totals: { legendaries: 1 } });
      await play(guest, 's1', T0);
      await play(ranked, 's1', T0 + 3 * MINUTE);
      const events = await db.select().from(feedEvents);
      expect(events.filter((event) => event.kind === 'item')).toEqual([expect.objectContaining({ playerId: ranked.id, detail: 'tool-a' })]);
    });

    it('keeps the best item on the profile and shows it on the leaderboard', async () => {
      const ranked = await newStudent({ nickname: 'Joana' });
      fake.script.drops = [{ base: 'tool-b', rarity: 'epico' }];
      await play(ranked, 's1', T0);
      fake.script.drops = [{ base: 'tool-a', rarity: 'raro' }];
      await play(ranked, 's1', T0 + 2 * MINUTE);
      expect(await profileRow(ranked)).toMatchObject({ bestItemBase: 'tool-b', bestItemRarity: 'epico' });
      const board = await getLeaderboard(db, 'coins', T0);
      expect(board.entries.find((entry) => entry.nickname === 'Joana')?.item).toEqual({ base: 'tool-b', rarity: 'epico' });
    });

    it('leaves the leaderboard entries of players without items as they were', async () => {
      await newPlayer({ nickname: 'Sem' });
      const board = await getLeaderboard(db, 'coins', T0);
      expect(board.entries[0]?.item ?? null).toBeNull();
    });

    it('counts a daily victory for the day and starts again the next day', async () => {
      const browser = await newStudent();
      const result = await play(browser, 'daily', T0);
      expect(result.rewards.firstClear).toBe(false);
      expect(result.profile.daily).toEqual({ dateKey: '2026-10-02', clears: 1 });
      expect(result.profile.stages).toEqual({});
      const next = await getProfile(await ctxOf(browser, T0 + 24 * 60 * MINUTE));
      expect(next.profile?.daily).toEqual({ dateKey: '2026-10-03', clears: 0 });
    });
  });

  describe('equip, skills, mentors, items', () => {
    it('equips an owned item in its slot, empties a slot, and refuses the rest', async () => {
      const browser = await newStudent();
      const other = await newStudent({ ip: '10.0.0.2' });
      const tool = await giveItem(browser, 'tool-a');
      const setup = await giveItem(browser, 'setup-a');
      const foreign = await giveItem(other, 'tool-a');

      const equipped = await equipItem(await ctxOf(browser), { slot: 'ferramenta', itemId: tool.id });
      expect(equipped.profile.equipped.ferramenta).toBe(tool.id);
      await expectFailure(equipItem(await ctxOf(browser), { slot: 'ferramenta', itemId: setup.id }), 'forbidden');
      await expectFailure(equipItem(await ctxOf(browser), { slot: 'ferramenta', itemId: foreign.id }), 'not_found');
      await expectFailure(equipItem(await ctxOf(browser), { slot: 'ferramenta', itemId: 'nope' }), 'not_found');
      const emptied = await equipItem(await ctxOf(browser), { slot: 'ferramenta', itemId: null });
      expect(emptied.profile.equipped.ferramenta).toBeNull();
    });

    it('buys skill nodes with points and prerequisites, never beyond the points or the maximum', async () => {
      const browser = await newStudent();
      await expectFailure(manageSkills(await ctxOf(browser), { action: 'buy', node: 'n1' }), 'forbidden'); // no points at level 1
      await patchProfile(browser, { level: 3 }); // 2 points
      await expectFailure(manageSkills(await ctxOf(browser), { action: 'buy', node: 'n2' }), 'forbidden'); // needs n1
      await expectFailure(manageSkills(await ctxOf(browser), { action: 'buy', node: 'nope' }), 'not_found');
      const bought = await manageSkills(await ctxOf(browser), { action: 'buy', node: 'n1' });
      expect(bought.profile).toMatchObject({ skillNodes: { n1: 1 }, freeSkillPoints: 1 });
      const second = await manageSkills(await ctxOf(browser), { action: 'buy', node: 'n2' });
      expect(second.profile).toMatchObject({ skillNodes: { n1: 1, n2: 1 }, freeSkillPoints: 0 });
      await expectFailure(manageSkills(await ctxOf(browser), { action: 'buy', node: 'n1' }), 'forbidden');
    });

    it('sets active skills within the cargo slots and the owned nodes', async () => {
      const browser = await newStudent();
      await patchProfile(browser, { level: 3, skillNodes: { n1: 1, n2: 1 } });
      await expectFailure(manageSkills(await ctxOf(browser), { action: 'active', skills: ['sk2'] }), 'forbidden'); // not learned
      await expectFailure(manageSkills(await ctxOf(browser), { action: 'active', skills: ['zzz'] }), 'not_found');
      await expectFailure(manageSkills(await ctxOf(browser), { action: 'active', skills: ['sk1', 'sk1'] }), 'invalid');
      await expectFailure(manageSkills(await ctxOf(browser), { action: 'active', skills: ['sk1', 'sk2'] }), 'forbidden'); // one slot
      const set = await manageSkills(await ctxOf(browser), { action: 'active', skills: ['sk1'] });
      expect(set.profile.activeSkills).toEqual(['sk1']);
      expect(set.profile.build.skills).toEqual(['sk1']);
    });

    it('respecs for Commits, refunding every point and clearing the active skills', async () => {
      const browser = await newStudent();
      await patchProfile(browser, { level: 3, skillNodes: { n1: 1, n2: 1 }, activeSkills: ['sk1'], commits: 150 });
      const result = await manageSkills(await ctxOf(browser), { action: 'respec' });
      expect(result.profile).toMatchObject({ commits: 50, skillNodes: {}, activeSkills: [], freeSkillPoints: 2 });
      await expectFailure(manageSkills(await ctxOf(browser), { action: 'respec' }), 'forbidden');
      expect((await profileRow(browser)).commits).toBe(50);
    });

    it('buys mentor levels only for unlocked mentors, with enough Commits, up to the maximum', async () => {
      const browser = await newStudent();
      await expectFailure(buyMentorLevel(await ctxOf(browser), { professor: 'edecio' }), 'forbidden'); // no Commits
      await patchProfile(browser, { commits: 25 });
      await expectFailure(buyMentorLevel(await ctxOf(browser), { professor: 'gladimir' }), 'forbidden'); // never hired
      await expectFailure(buyMentorLevel(await ctxOf(browser), { professor: 'wagner' }), 'not_found'); // no mentor defined
      const first = await buyMentorLevel(await ctxOf(browser), { professor: 'edecio' });
      expect(first.profile).toMatchObject({ commits: 15 });
      expect(first.profile.mentors.edecio.level).toBe(1);
      await expectFailure(buyMentorLevel(await ctxOf(browser), { professor: 'edecio' }), 'forbidden'); // costs 20
      expect((await profileRow(browser)).commits).toBe(15);
      await patchProfile(browser, { commits: 100 });
      await buyMentorLevel(await ctxOf(browser), { professor: 'edecio' });
      await expectFailure(buyMentorLevel(await ctxOf(browser), { professor: 'edecio' }), 'forbidden'); // maxed
      const hiredB2 = await buyMentorLevel(await ctxOf(browser), { professor: 'b2' });
      expect(hiredB2.profile.mentors.b2.level).toBe(1);
    });

    it("recycles items for Commits, never an equipped one and never someone else's", async () => {
      const browser = await newStudent();
      const other = await newStudent({ ip: '10.0.0.2' });
      const keep = await giveItem(browser, 'tool-a', 'comum');
      const sell = await giveItem(browser, 'tool-b', 'raro');
      const sell2 = await giveItem(browser, 'setup-a', 'epico');
      const foreign = await giveItem(other, 'tool-a', 'lendario');
      await equipItem(await ctxOf(browser), { slot: 'ferramenta', itemId: keep.id });

      await expectFailure(manageItems(await ctxOf(browser), { action: 'recycle', itemIds: [keep.id] }), 'forbidden');
      await expectFailure(manageItems(await ctxOf(browser), { action: 'recycle', itemIds: [sell.id, foreign.id] }), 'not_found');
      expect(await db.select().from(hackathonItems).where(eq(hackathonItems.id, sell.id))).toHaveLength(1);

      const result = await manageItems(await ctxOf(browser), { action: 'recycle', itemIds: [sell.id, sell2.id, sell.id] });
      expect(result.profile.commits).toBe(30 + 40);
      expect(result.profile.items.map((item) => item.id)).toEqual([keep.id]);
      expect(await profileRow(browser)).toMatchObject({ bestItemBase: 'tool-a', bestItemRarity: 'comum' });
      expect((await profileRow(other)).commits).toBe(0);
    });

    it('rerolls an affix for Commits, never the primary, doubling the price each time', async () => {
      const browser = await newStudent();
      const item = await giveItem(browser, 'tool-a', 'raro');
      await patchProfile(browser, { commits: 160 });
      await expectFailure(manageItems(await ctxOf(browser), { action: 'reroll', itemId: item.id, affixIndex: 0 }), 'invalid');
      await expectFailure(manageItems(await ctxOf(browser), { action: 'reroll', itemId: item.id, affixIndex: 5 }), 'invalid');
      await expectFailure(manageItems(await ctxOf(browser), { action: 'reroll', itemId: 'nope', affixIndex: 1 }), 'not_found');
      expect((await profileRow(browser)).commits).toBe(160);

      const first = await manageItems(await ctxOf(browser), { action: 'reroll', itemId: item.id, affixIndex: 1 });
      expect(first.profile.commits).toBe(110);
      expect(first.profile.items[0]).toMatchObject({ rerolls: 1, id: item.id });
      expect(first.profile.items[0]?.affixes[1]?.value).toBe(4);
      expect(first.profile.items[0]?.affixes[0]).toEqual(item.affixes[0]);
      const second = await manageItems(await ctxOf(browser), { action: 'reroll', itemId: item.id, affixIndex: 1 });
      expect(second.profile.commits).toBe(10);
      await expectFailure(manageItems(await ctxOf(browser), { action: 'reroll', itemId: item.id, affixIndex: 1 }), 'forbidden');
      expect((await profileRow(browser)).commits).toBe(10);
    });

    it('can never take the balance below zero, even under concurrent spending', async () => {
      const browser = await newStudent();
      const item = await giveItem(browser, 'tool-a', 'raro');
      await patchProfile(browser, { commits: 60 });
      const results = await Promise.allSettled(
        [1, 1, 1, 1].map(async () => manageItems(await ctxOf(browser), { action: 'reroll', itemId: item.id, affixIndex: 1 })),
      );
      expect(results.filter((entry) => entry.status === 'fulfilled')).toHaveLength(1);
      expect((await profileRow(browser)).commits).toBe(10);
      await expect(patchProfile(browser, { commits: -1 })).rejects.toThrow();
    });
  });

  describe('classroom links at sync', () => {
    interface Sync {
      browser: Browser;
      state: GameState;
    }

    async function syncSave(target: Sync, patch: { cafesBought?: number; graduations?: number }, now: number, deps = fake.deps) {
      const state = roundTrip(target.state);
      if (patch.cafesBought !== undefined) state.counters.cafesBought = patch.cafesBought;
      if (patch.graduations !== undefined) state.counters.graduations = patch.graduations;
      target.state = state;
      const result = await syncPlayer(db, {
        request: { save: serializeState(state), baseRev: target.browser.rev },
        token: target.browser.token,
        ip: '10.0.0.1',
        now,
        hackathon: deps,
      });
      if (result.body.status === 'ok') target.browser.rev = result.body.rev;
      return result.body;
    }

    async function syncedStudent(): Promise<Sync> {
      const state = saveOf({ cafesBought: 5, graduations: 2 }); // history before the student existed
      const browser = await newPlayer({ state });
      await saveProfile(await ctxOf(browser), { head: 'h1' });
      return { browser, state };
    }

    it('pays nothing for what happened before the student existed', async () => {
      const target = await syncedStudent();
      expect(await profileRow(target.browser)).toMatchObject({ cafesBoughtCredited: 5, graduationsCredited: 2 });
      await syncSave(target, {}, T0 + 60_000);
      expect((await profileRow(target.browser)).xp).toBe(0);
    });

    it('credits purchases up to the room in the bar and keeps the rest pending until there is room', async () => {
      const target = await syncedStudent();
      await db
        .update(hackathonProfiles)
        .set({ cafeCount: 0, cafeAt: new Date(T0) })
        .where(eq(hackathonProfiles.playerId, target.browser.id));
      await syncSave(target, { cafesBought: 8 }, T0 + 60_000);
      expect(await profileRow(target.browser)).toMatchObject({ cafeCount: 3, cafesBoughtCredited: 8 });
      // The bar is full: bought Café never exceeds the maximum, so two purchases wait.
      await syncSave(target, { cafesBought: 10 }, T0 + 120_000);
      expect(await profileRow(target.browser)).toMatchObject({ cafeCount: 3, cafesBoughtCredited: 8 });
      expect((await getProfile(await ctxOf(target.browser, T0 + 120_000))).profile?.cafe).toMatchObject({ count: 3, nextAt: null });
      // After spending one there is room for one of them.
      await startRun(await ctxOf(target.browser, T0 + 130_000), { stageId: 's1', auto: false });
      await syncSave(target, {}, T0 + 150_000);
      expect(await profileRow(target.browser)).toMatchObject({ cafeCount: 3, cafesBoughtCredited: 9, cafesCreditedToday: 4 });
    });

    it('caps credited purchases per day and starts again the next day', async () => {
      const target = await syncedStudent();
      await db
        .update(hackathonProfiles)
        .set({ cafeCount: 0, cafeAt: new Date(T0) })
        .where(eq(hackathonProfiles.playerId, target.browser.id));
      await syncSave(target, { cafesBought: 5 + 10 }, T0 + 60_000);
      expect(await profileRow(target.browser)).toMatchObject({ cafeCount: 3, cafesBoughtCredited: 8, cafesCreditedToday: 3 });
      await db
        .update(hackathonProfiles)
        .set({ cafeCount: 0, cafeAt: new Date(T0 + 70_000) })
        .where(eq(hackathonProfiles.playerId, target.browser.id));
      // Cap of 4 per day in the fixture: one more today, then nothing.
      await syncSave(target, {}, T0 + 80_000);
      expect(await profileRow(target.browser)).toMatchObject({ cafeCount: 1, cafesBoughtCredited: 9, cafesCreditedToday: 4 });
      await syncSave(target, {}, T0 + 90_000);
      expect((await profileRow(target.browser)).cafesBoughtCredited).toBe(9);
      const tomorrow = T0 + 24 * 60 * MINUTE;
      await db
        .update(hackathonProfiles)
        .set({ cafeCount: 0, cafeAt: new Date(tomorrow) })
        .where(eq(hackathonProfiles.playerId, target.browser.id));
      await syncSave(target, {}, tomorrow + 60_000);
      expect(await profileRow(target.browser)).toMatchObject({
        cafeCount: 3,
        cafesBoughtCredited: 12,
        creditDay: '2026-10-03',
        cafesCreditedToday: 3,
      });
    });

    it('refills the Café and gives XP for each new graduation, capped per day', async () => {
      const target = await syncedStudent();
      await db
        .update(hackathonProfiles)
        .set({ cafeCount: 0, cafeAt: new Date(T0) })
        .where(eq(hackathonProfiles.playerId, target.browser.id));
      await syncSave(target, { graduations: 5 }, T0 + 60_000); // 3 new, cap of 1 in the fixture
      expect(await profileRow(target.browser)).toMatchObject({ cafeCount: 3, xp: 50, graduationsCredited: 5, graduationsCreditedToday: 1 });
      await syncSave(target, { graduations: 6 }, T0 + 120_000);
      expect((await profileRow(target.browser)).xp).toBe(50);
    });

    it('credits nothing when the counters went backwards', async () => {
      const target = await syncedStudent();
      await db
        .update(hackathonProfiles)
        .set({ cafeCount: 0, cafeAt: new Date(T0) })
        .where(eq(hackathonProfiles.playerId, target.browser.id));
      const body = await syncSave(target, { cafesBought: 1, graduations: 0 }, T0 + 60_000);
      expect(body.status).toBe('ok');
      expect(await profileRow(target.browser)).toMatchObject({ cafeCount: 0, xp: 0, cafesBoughtCredited: 5, graduationsCredited: 2 });
    });

    it('answers with the bonus on sync (ok and conflict), /api/me and login, and not for a player without a student', async () => {
      const target = await syncedStudent();
      await patchProfile(target.browser, { cargo: 'estagiario', mentors: { edecio: 2 } });
      const ok = await syncSave(target, {}, T0 + 60_000);
      expect(ok).toMatchObject({ status: 'ok', bonus: { cargo: 1.25, mentors: { edecio: 1.2 } } });

      const stale = await syncPlayer(db, {
        request: { save: serializeState(target.state), baseRev: 0 },
        token: target.browser.token,
        ip: '10.0.0.1',
        now: T0 + 120_000,
        hackathon: fake.deps,
      });
      expect(stale.body).toMatchObject({ status: 'conflict', bonus: { cargo: 1.25 } });

      const me = await getMe(db, target.browser.headers, T0 + 130_000, fake.deps);
      expect(me.body.bonus).toEqual({ cargo: 1.25, mentors: { edecio: 1.2 } });

      await setNickname(db, await requireSession(db, target.browser.headers, T0), { nickname: 'Bonus', password: 'segredo123' }, T0);
      const loggedIn = await login(
        db,
        { nickname: 'Bonus', password: 'segredo123' },
        { ip: '10.0.0.9', currentToken: null, now: T0 + 140_000, hackathon: fake.deps },
      );
      expect(loggedIn.body.bonus).toEqual({ cargo: 1.25, mentors: { edecio: 1.2 } });

      const plain = await newPlayer({ ip: '10.0.0.5' });
      const plainMe = await getMe(db, plain.headers, T0 + 1000, fake.deps);
      expect(plainMe.body.bonus).toBeUndefined();
      expect('bonus' in plainMe.body).toBe(false);
    });

    it("stores the server's bonus in the save, ignoring the client's", async () => {
      const target = await syncedStudent();
      await patchProfile(target.browser, { cargo: 'estagiario' });
      const forged = roundTrip(target.state);
      forged.cloudBonus = { cargo: 9, mentors: { edecio: 5 } };
      const result = await syncPlayer(db, {
        request: { save: serializeState(forged), baseRev: target.browser.rev },
        token: target.browser.token,
        ip: '10.0.0.1',
        now: T0 + 60_000,
        hackathon: fake.deps,
      });
      expect(result.body.status).toBe('ok');
      const { players } = await import('../db/schema');
      const [row] = await db.select({ save: players.save }).from(players).where(eq(players.id, target.browser.id));
      const stored = JSON.parse(row!.save!) as { cloudBonus?: { cargo: number; mentors: Record<string, number> } };
      expect(stored.cloudBonus).toEqual({ cargo: 1.25, mentors: {} });

      const plain = await newPlayer({ ip: '10.0.0.6' });
      const forged2 = roundTrip(saveOf());
      forged2.cloudBonus = { cargo: 9, mentors: {} };
      await syncPlayer(db, {
        request: { save: serializeState(forged2), baseRev: plain.rev },
        token: plain.token,
        ip: '10.0.0.6',
        now: T0 + 60_000,
        hackathon: fake.deps,
      });
      const [plainRow] = await db.select({ save: players.save }).from(players).where(eq(players.id, plain.id));
      expect((JSON.parse(plainRow!.save!) as { cloudBonus?: { cargo: number } }).cloudBonus?.cargo).toBe(1);
    });

    it('keeps syncing, without bonus or credits, while the Hackathon is not ready', async () => {
      const target = await syncedStudent();
      const notReady = { ...fake.deps, content: { ...fixtureContent, stages: [] } };
      const body = await syncSave(target, { cafesBought: 9 }, T0 + 60_000, notReady);
      expect(body.status).toBe('ok');
      expect('bonus' in body).toBe(false);
      expect((await profileRow(target.browser)).cafesBoughtCredited).toBe(5);
    });
  });

  it('removes everything of a player with the player', async () => {
    const browser = await newStudent();
    await giveItem(browser);
    await play(browser, 's1', T0);
    const { players } = await import('../db/schema');
    await db.delete(players).where(eq(players.id, browser.id));
    for (const table of [hackathonProfiles, hackathonItems, hackathonRuns, hackathonStages]) {
      expect(await db.select().from(table)).toHaveLength(0);
    }
  });
});
