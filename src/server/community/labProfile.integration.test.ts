/**
 * The public lab profile against Postgres (`adsclicker_labprofile_test`): what a sync stores in `lab_profile`, who has a
 * profile (the boards' exclusion rules), and that ids the game does not know never reach the page. Skips itself when the
 * database cannot be reached, like the other integration tests.
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { content } from '@/game/content';
import { serializeState } from '@/game/engine';
import type { GameState } from '@/game/engine/state';
import { labProfileSchema } from '@/shared/api';
import type { SyncRequest } from '@/shared/api';
import { SESSION_COOKIE, readSessionToken } from '../auth/session';
import { players } from '../db/schema';
import { logEvent } from '../logs/log';
import { nicknameKey } from '../players/nickname';
import { syncPlayer } from '../players/sync';
import { connectTestDb } from '../testing/db';
import { playWindows } from '../testing/play';
import { clearLabProfileCache, getLabProfile } from './labProfile';

vi.mock('../logs/log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../logs/log')>()),
  logEvent: vi.fn(),
}));

const testDb = await connectTestDb({ database: 'adsclicker_labprofile_test' });
afterAll(async () => {
  await testDb?.close();
});

const T0 = Date.UTC(2026, 9, 1, 12, 0, 0);

describe.skipIf(!testDb)('the public lab profile against Postgres', () => {
  if (!testDb) return;
  const { db } = testDb;

  beforeEach(async () => {
    await testDb.reset();
    vi.mocked(logEvent).mockClear();
    clearLabProfileCache();
  });

  async function row(values: Partial<typeof players.$inferInsert> & { nickname: string | null }) {
    const [created] = await db
      .insert(players)
      .values({
        nicknameKey: values.nickname === null ? null : nicknameKey(values.nickname),
        rev: 1,
        ...values,
      })
      .returning();
    return created!;
  }

  const profile = (monitor = 'monitor-gamer-rgb') => ({
    monitor,
    theme: 'tema-madrugada',
    decor: ['cacto', 'luminaria'],
    startItem: 'trackball',
    stats: {
      bestPhase: 12,
      commitsEarned: 340,
      runs: 6,
      broken: 5,
      phasesCleared: 40,
      bossesBeaten: 4,
      itemsFound: 22,
      itemsRecycled: 9,
      itemLevelUps: 3,
      affixRerolls: 1,
      clicks: 900,
      cosmeticsOwned: 6,
    },
  });

  describe('what a sync stores', () => {
    const states: GameState[] = playWindows({
      windows: 4,
      seed: 1,
      clicksPerSecond: 4,
      graduate: false,
    }).map((window) => window.next);
    const body = (state: GameState, baseRev: number): SyncRequest => ({
      save: serializeState(state),
      baseRev,
      epoch: 0,
    });

    it('derives lab_profile from the save: what is worn and the lifetime numbers, nothing while the lab is locked', async () => {
      let token: string | null = null;
      let rev = 0;
      let now = T0;
      for (const state of states.slice(0, 3)) {
        const result = await syncPlayer(db, {
          request: body(state, rev),
          token,
          ip: '10.0.0.1',
          now,
        });
        if (result.body.status !== 'ok') throw new Error('unexpected');
        if (token === null) token = readSessionToken(new Headers({ cookie: result.cookies[0]?.split(';')[0] ?? '' }));
        rev = result.body.rev;
        now += 45_000;
      }
      const id = (await db.select({ id: players.id }).from(players))[0]!.id;
      expect((await db.select().from(players).where(eq(players.id, id)))[0]!.labProfile).toBeNull(); // lab never unlocked

      const save = states[3]!;
      save.lab.unlocked = true;
      save.lab.cosmetics.owned = {
        'monitor-gamer-rgb': true,
        cacto: true,
        'tema-madrugada': true,
      };
      save.lab.cosmetics.monitor = 'monitor-gamer-rgb';
      save.lab.cosmetics.theme = 'tema-madrugada';
      save.lab.cosmetics.decor = ['cacto'];
      save.lab.counters.runs = 2;
      save.lab.counters.commitsEarned = 55;
      const result = await syncPlayer(db, {
        request: body(save, rev),
        token: token!,
        ip: '10.0.0.1',
        now,
      });
      expect(result.body.status).toBe('ok');
      const [stored] = await db.select().from(players).where(eq(players.id, id));
      expect(stored!.labProfile).toMatchObject({
        monitor: 'monitor-gamer-rgb',
        theme: 'tema-madrugada',
        decor: ['cacto'],
        startItem: 'mouse-quebrado',
        stats: { runs: 2, commitsEarned: 55, cosmeticsOwned: 6 }, // 3 free defaults + 3 owned
      });
      expect(SESSION_COOKIE).toBeTruthy();
    });
  });

  describe('the endpoint', () => {
    it('shows what they wear, their records and their numbers, and validates against the schema', async () => {
      await row({
        nickname: 'Ana Luz',
        avatarProfessor: 'pablo',
        avatarSkin: 'skin-x',
        labProfile: profile(),
        labBestPhase: 31,
        labBestPhaseBuild: [
          {
            slot: 'ferramenta',
            base: 'mouse-quebrado',
            rarity: 'comum',
            level: 1,
          },
        ],
        bestRunCoinsText: '2.5e+30',
      });
      const result = await getLabProfile(db, 'ana luz', T0);
      expect(labProfileSchema.safeParse(result).success).toBe(true);
      expect(result).toMatchObject({
        nickname: 'Ana Luz',
        professor: 'pablo',
        skin: 'skin-x',
        monitor: 'monitor-gamer-rgb',
        theme: 'tema-madrugada',
        decor: ['cacto', 'luminaria'],
        startItem: 'trackball',
        bestPhase: 31,
        bestRunCoins: '2.5e+30',
        stats: { runs: 6, bossesBeaten: 4, cosmeticsOwned: 6 },
      });
      expect(result.phaseBuild).toHaveLength(1);
      expect(result.runBuild).toEqual([]);
    });

    it('reads through the content: unknown or wrong-kind ids fall back, extra decorations are cut, numbers are clamped', async () => {
      await row({
        nickname: 'Velha',
        labProfile: {
          monitor: 'monitor-que-sumiu',
          theme: 'cacto',
          decor: ['cacto', 'cacto', 'item-que-sumiu', 'luminaria', 'caneca-do-plantao', 'lixeira-reciclagem', 'luz-neon-codigo'],
          startItem: 'monitor-tela-azul',
          stats: { runs: -4, clicks: 'muitos', commitsEarned: 1e30 },
        } as never,
        labBestPhase: 5,
      });
      const result = await getLabProfile(db, 'Velha', T0);
      expect(result.monitor).toBe(content.lab.cosmetics.defaults.monitor);
      expect(result.theme).toBe(content.lab.cosmetics.defaults.theme);
      expect(result.startItem).toBe(content.lab.cosmetics.defaults.startItem);
      expect(result.decor).toEqual(['cacto', 'luminaria', 'caneca-do-plantao', 'lixeira-reciclagem'].slice(0, content.lab.cosmetics.decorMax));
      expect(result.stats.runs).toBe(0);
      expect(result.stats.clicks).toBe(0);
      expect(result.stats.commitsEarned).toBe(1e12);
    });

    it('has no profile for flagged, banned, test accounts, players with no nickname, a locked lab, or nobody', async () => {
      await row({ nickname: 'Marcada', flagged: true, labProfile: profile() });
      await row({ nickname: 'Banida', banned: true, labProfile: profile() });
      await row({
        nickname: 'Teste',
        testAccount: true,
        labProfile: profile(),
      });
      await row({ nickname: 'SemLab', labProfile: null });
      await row({ nickname: null, labProfile: profile() });
      for (const nickname of ['Marcada', 'Banida', 'Teste', 'SemLab', 'Ninguem']) {
        clearLabProfileCache();
        await expect(getLabProfile(db, nickname, T0), nickname).rejects.toMatchObject({ code: 'not_found' });
      }
    });
  });
});
