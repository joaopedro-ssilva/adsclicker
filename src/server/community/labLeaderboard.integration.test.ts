/**
 * The Laboratório boards against Postgres (`adsclicker_labboard_test`): what a sync stores, who the boards list, in which
 * order, and the caller's own place. Skips itself when the database cannot be reached, like the other integration tests.
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { content } from '@/game/content';
import { Decimal, serializeState } from '@/game/engine';
import type { LabBuild } from '@/game/engine/lab/types';
import type { GameState } from '@/game/engine/state';
import { labLeaderboardResponseSchema } from '@/shared/api';
import type { SyncRequest } from '@/shared/api';
import { setNickname } from '../players/account';
import { requireSession } from '../auth/context';
import { SESSION_COOKIE, readSessionToken } from '../auth/session';
import { players } from '../db/schema';
import { syncPlayer } from '../players/sync';
import { logEvent } from '../logs/log';
import { connectTestDb } from '../testing/db';
import { playWindows } from '../testing/play';
import { clearLabLeaderboardCache, getLabLeaderboardTop, labBoardMe } from './labLeaderboard';

vi.mock('../logs/log', async (importOriginal) => ({ ...(await importOriginal<typeof import('../logs/log')>()), logEvent: vi.fn() }));

const testDb = await connectTestDb({ database: 'adsclicker_labboard_test' });
afterAll(async () => {
  await testDb?.close();
});

const T0 = Date.UTC(2026, 9, 1, 12, 0, 0);

const build = (rarity: 'comum' | 'raro' | 'lendario', level: number): LabBuild => [
  { slot: 'ferramenta', base: content.lab.starter, rarity, level },
  { slot: 'setup', base: 'cadeira-ergonomica', rarity, level },
];

describe.skipIf(!testDb)('the Laboratório boards against Postgres', () => {
  if (!testDb) return;
  const { db } = testDb;

  beforeEach(async () => {
    await testDb.reset();
    vi.mocked(logEvent).mockClear();
    clearLabLeaderboardCache();
  });

  let key = 0;
  /** A player row made directly: the boards read columns, so the columns are what the test sets. */
  async function row(values: Partial<typeof players.$inferInsert> & { nickname: string | null }) {
    key += 1;
    const [created] = await db
      .insert(players)
      .values({ nicknameKey: values.nickname === null ? null : `k${key}`, rev: 1, ...values })
      .returning();
    return created!;
  }

  const at = (minutes: number) => new Date(T0 + minutes * 60_000);

  describe('what a sync stores', () => {
    const states: GameState[] = playWindows({ windows: 4, seed: 1, clicksPerSecond: 4, graduate: false }).map((window) => window.next);
    const body = (state: GameState, baseRev: number): SyncRequest => ({ save: serializeState(state), baseRev, epoch: 0 });

    /** Syncs the first three saves, then returns what is needed to send a fourth. */
    async function warmedUp() {
      let token: string | null = null;
      let rev = 0;
      let now = T0;
      for (const state of states.slice(0, 3)) {
        const result = await syncPlayer(db, { request: body(state, rev), token, ip: '10.0.0.1', now });
        if (result.body.status !== 'ok') throw new Error('unexpected');
        if (token === null) token = readSessionToken(new Headers({ cookie: result.cookies[0]?.split(';')[0] ?? '' }));
        rev = result.body.rev;
        now += 45_000;
      }
      return { token: token!, rev, now, id: (await db.select({ id: players.id }).from(players))[0]!.id };
    }

    function withLab(state: GameState, phase: number): GameState {
      // Edits the state in place (each test sets every lab field it relies on, so they do not leak into one another).
      state.lab.unlocked = true;
      state.lab.bestPhase = phase;
      state.lab.bestPhaseBuild = build('raro', 4);
      state.lab.bestRunBuild = build('lendario', 9);
      state.lab.counters.phasesCleared = phase - 1;
      state.records.mostCoins = new Decimal(state.runCoins.toString());
      return state;
    }

    it('stores the highest phase, the best turma and their builds, and stamps the time of a new phase', async () => {
      const first = await warmedUp();
      const save = withLab(states[3]!, 6);
      const result = await syncPlayer(db, { request: body(save, first.rev), token: first.token, ip: '10.0.0.1', now: first.now });
      expect(result.body.status).toBe('ok');
      const [stored] = await db.select().from(players).where(eq(players.id, first.id));
      expect(stored).toMatchObject({ flagged: false, labBestPhase: 6 });
      expect(stored!.labBestPhaseBuild).toEqual(build('raro', 4));
      expect(stored!.labBestPhaseAt?.getTime()).toBe(first.now);
      expect(stored!.bestRunBuild).toEqual(build('lendario', 9));
      expect(Number(stored!.bestRunCoinsLog)).toBeGreaterThan(0);
      expect(new Decimal(stored!.bestRunCoinsText).eq(states[3]!.runCoins)).toBe(true);
    });

    it('flags a player whose highest phase jumps further than the time allows, and a best turma above the lifetime coins', async () => {
      const first = await warmedUp();
      const jump = withLab(states[3]!, 90);
      await syncPlayer(db, { request: body(jump, first.rev), token: first.token, ip: '10.0.0.1', now: first.now });
      const [flagged] = await db.select().from(players).where(eq(players.id, first.id));
      expect(flagged).toMatchObject({ flagged: true });
      expect(flagged!.flagReason).toContain('lab phase');
    });

    it('flags a best turma above the lifetime coins', async () => {
      const first = await warmedUp();
      const forged = withLab(states[3]!, 3);
      forged.records.mostCoins = forged.lifetimeCoins.mul(100);
      await syncPlayer(db, { request: body(forged, first.rev), token: first.token, ip: '10.0.0.1', now: first.now });
      const [flagged] = await db.select().from(players).where(eq(players.id, first.id));
      expect(flagged).toMatchObject({ flagged: true });
      expect(flagged!.flagReason).toContain('best run');
    });

    it('keeps a flagged player off the boards', async () => {
      const first = await warmedUp();
      await setNickname(db, await requireSession(db, new Headers({ cookie: `${SESSION_COOKIE}=${first.token}` }), first.now), { nickname: 'Fraudador', password: 'senha-padrao' }, first.now);
      await syncPlayer(db, { request: body(withLab(states[3]!, 90), first.rev), token: first.token, ip: '10.0.0.1', now: first.now });
      const top = await getLabLeaderboardTop(db, 'phase', first.now);
      expect(top.entries.map((entry) => entry.nickname)).not.toContain('Fraudador');
    });
  });

  describe('the lists', () => {
    it('orders "Mais longe" by phase, then by who got there first, and ignores whoever has no record', async () => {
      await row({ nickname: 'Lenta', labBestPhase: 20, labBestPhaseAt: at(30), labBestPhaseBuild: build('raro', 3) });
      await row({ nickname: 'Primeira', labBestPhase: 20, labBestPhaseAt: at(10) });
      const other = Object.keys(content.professors).find((id) => id !== 'edecio') as 'pablo';
      await row({ nickname: 'Topo', labBestPhase: 31, labBestPhaseAt: at(50), avatarProfessor: other, avatarSkin: 'skin-x' });
      await row({ nickname: 'Baixa', labBestPhase: 4, labBestPhaseAt: at(1) });
      await row({ nickname: 'SemRecorde', labBestPhase: 0 });

      const top = await getLabLeaderboardTop(db, 'phase', T0);
      expect(top.entries.map((entry) => [entry.rank, entry.nickname, entry.value])).toEqual([
        [1, 'Topo', '31'],
        [2, 'Primeira', '20'],
        [3, 'Lenta', '20'],
        [4, 'Baixa', '4'],
      ]);
      expect(top.entries[2]!.build).toEqual(build('raro', 3));
      // the avatar comes from the same columns as the community board (a default professor when none was set)
      expect(top.entries[0]).toMatchObject({ professor: other, skin: 'skin-x' });
      expect(top.entries[1]).toMatchObject({ professor: 'edecio', skin: '' });
      expect(top.entries[0]!.build).toEqual([]);
      expect(labLeaderboardResponseSchema.safeParse({ ...top, me: null }).success).toBe(true);
    });

    it('orders "Maior turma" by the coins, whatever their size', async () => {
      await row({ nickname: 'Pequena', bestRunCoinsText: '5e+12', bestRunCoinsLog: 12.7 });
      await row({ nickname: 'Enorme', bestRunCoinsText: '2.5e+250', bestRunCoinsLog: 250.4, bestRunBuild: build('lendario', 12) });
      await row({ nickname: 'Media', bestRunCoinsText: '7e+40', bestRunCoinsLog: 40.85 });
      const top = await getLabLeaderboardTop(db, 'run', T0);
      expect(top.entries.map((entry) => [entry.rank, entry.nickname, entry.value])).toEqual([
        [1, 'Enorme', '2.5e+250'],
        [2, 'Media', '7e+40'],
        [3, 'Pequena', '5e+12'],
      ]);
      expect(top.entries[0]!.build).toEqual(build('lendario', 12));
    });

    it('leaves out flagged, banned and test accounts and players with no nickname, exactly like the other boards', async () => {
      await row({ nickname: 'Honesta', labBestPhase: 10, labBestPhaseAt: at(1), bestRunCoinsText: '1e+20', bestRunCoinsLog: 20 });
      for (const [nickname, extra] of [
        ['Marcada', { flagged: true }],
        ['Banida', { banned: true }],
        ['Teste', { testAccount: true }],
        [null, {}],
      ] as const) {
        await row({ nickname, ...extra, labBestPhase: 99, labBestPhaseAt: at(0), bestRunCoinsText: '9e+99', bestRunCoinsLog: 99.9 });
      }
      for (const board of ['phase', 'run'] as const) {
        clearLabLeaderboardCache();
        const top = await getLabLeaderboardTop(db, board, T0);
        expect(top.entries.map((entry) => entry.nickname)).toEqual(['Honesta']);
      }
    });

    it('lists at most 50, and reads a build back through the content (unknown ids drop out)', async () => {
      for (let i = 0; i < 55; i += 1) await row({ nickname: `J${i}`, labBestPhase: 100 - i, labBestPhaseAt: at(i) });
      await row({
        nickname: 'Velha',
        labBestPhase: 200,
        labBestPhaseAt: at(0),
        labBestPhaseBuild: [{ slot: 'setup', base: 'item-que-sumiu', rarity: 'raro', level: 3 }, ...build('comum', 1)],
      });
      const top = await getLabLeaderboardTop(db, 'phase', T0);
      expect(top.entries).toHaveLength(50);
      expect(top.entries[0]!.nickname).toBe('Velha');
      expect(top.entries[0]!.build.map((entry) => entry.base)).toEqual([content.lab.starter, 'cadeira-ergonomica']);
    });
  });

  describe('the caller\'s own row', () => {
    it('gives the true place, even past the 50, and nothing to an unranked player', async () => {
      for (let i = 0; i < 52; i += 1) await row({ nickname: `J${i}`, labBestPhase: 100 - i, labBestPhaseAt: at(i), bestRunCoinsLog: 60 - i, bestRunCoinsText: `1e+${60 - i}` });
      const me = await row({ nickname: 'Eu', labBestPhase: 40, labBestPhaseAt: at(5), bestRunCoinsLog: 5, bestRunCoinsText: '1e+5' });
      const phase = await labBoardMe(db, 'phase', me, T0);
      // 52 players are ahead (every J has 100 - i >= 49 > 40)
      expect(phase).toMatchObject({ rank: 53, nickname: 'Eu', value: '40' });
      const run = await labBoardMe(db, 'run', me, T0);
      expect(run?.rank).toBe(53);

      const tied = await row({ nickname: 'Empate', labBestPhase: 40, labBestPhaseAt: at(1) });
      expect((await labBoardMe(db, 'phase', tied, T0))?.rank).toBe(53);
      expect((await labBoardMe(db, 'phase', me, T0))?.rank).toBe(54);

      const flagged = await row({ nickname: 'Marcado', flagged: true, labBestPhase: 40, labBestPhaseAt: at(2) });
      expect(await labBoardMe(db, 'phase', flagged, T0)).toBeNull();
      const none = await row({ nickname: 'SemRecorde', labBestPhase: 0 });
      expect(await labBoardMe(db, 'phase', none, T0)).toBeNull();
    });
  });
});
