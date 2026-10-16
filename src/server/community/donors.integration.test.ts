/**
 * The Centro Comunitário board against Postgres (`adsclicker_donors_test`): what a sync stores, the plausibility of the
 * total, who the board lists, in which order, and the caller's own place. Skips itself when the database cannot be
 * reached, like the other integration tests.
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Decimal, serializeState } from '@/game/engine';
import type { GameState } from '@/game/engine/state';
import { donorsResponseSchema } from '@/shared/api';
import type { SyncRequest } from '@/shared/api';
import { requireSession } from '../auth/context';
import { SESSION_COOKIE, readSessionToken } from '../auth/session';
import { players } from '../db/schema';
import { logEvent } from '../logs/log';
import { setNickname } from '../players/account';
import { syncPlayer } from '../players/sync';
import { connectTestDb } from '../testing/db';
import { playWindows } from '../testing/play';
import { clearDonorsCache, donorsMe, getDonorsTop } from './donors';

vi.mock('../logs/log', async (importOriginal) => ({ ...(await importOriginal<typeof import('../logs/log')>()), logEvent: vi.fn() }));

const testDb = await connectTestDb({ database: 'adsclicker_donors_test' });
afterAll(async () => {
  await testDb?.close();
});

const T0 = Date.UTC(2026, 9, 1, 12, 0, 0);

describe.skipIf(!testDb)('the donors board against Postgres', () => {
  if (!testDb) return;
  const { db } = testDb;

  beforeEach(async () => {
    await testDb.reset();
    vi.mocked(logEvent).mockClear();
    clearDonorsCache();
  });

  let key = 0;
  /** A player row made directly: the board reads columns, so the columns are what the test sets. */
  async function row(values: Partial<typeof players.$inferInsert> & { nickname: string | null }) {
    key += 1;
    const [created] = await db
      .insert(players)
      .values({ nicknameKey: values.nickname === null ? null : `k${key}`, rev: 1, ...values })
      .returning();
    return created!;
  }

  const gave = (log: number, text = `1e+${log}`) => ({ donatedLog: log, donatedText: text });

  describe('what a sync stores and judges', () => {
    const body = (state: GameState, baseRev: number): SyncRequest => ({ save: serializeState(state), baseRev, epoch: 0 });

    /** Syncs the first three saves of an honest game and returns what is needed to send a fourth. */
    async function warmedUp() {
      const states = playWindows({ windows: 4, seed: 1, clicksPerSecond: 4, graduate: false }).map((window) => window.next);
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
      const id = (await db.select({ id: players.id }).from(players))[0]!.id;
      return { token: token!, rev, now, id, next: states[3]!, previous: states[2]! };
    }

    const sendNext = (w: Awaited<ReturnType<typeof warmedUp>>) =>
      syncPlayer(db, { request: body(w.next, w.rev), token: w.token, ip: '10.0.0.1', now: w.now });

    it('stores the total donated as exact text and log10', async () => {
      const w = await warmedUp();
      const half = w.previous.coins.div(2);
      expect(half.gt(1)).toBe(true);
      w.next.donated = half;
      await sendNext(w);
      const [stored] = await db.select().from(players).where(eq(players.id, w.id));
      expect(stored).toMatchObject({ flagged: false });
      expect(new Decimal(stored!.donatedText).eq(half)).toBe(true);
      expect(stored!.donatedLog).toBeCloseTo(half.log10(), 9);
    });

    it('flags a total that grew by more than the coins available', async () => {
      const w = await warmedUp();
      // Everything ever earned at once: far more than the coins in hand plus the gain of one window.
      w.next.donated = w.next.lifetimeCoins;
      await sendNext(w);
      const [stored] = await db.select().from(players).where(eq(players.id, w.id));
      expect(stored).toMatchObject({ flagged: true });
      expect(stored!.flagReason).toContain('donated');
    });

    it('flags a total that goes down', async () => {
      const w = await warmedUp();
      // Pretend the last accepted save already held a donation, by writing it into the stored save.
      const half = w.previous.coins.div(2);
      w.previous.donated = half;
      const [stored] = await db.select().from(players).where(eq(players.id, w.id));
      await db.update(players).set({ save: serializeState(w.previous) }).where(eq(players.id, stored!.id));
      w.next.donated = new Decimal(0);
      await sendNext(w);
      const [after] = await db.select().from(players).where(eq(players.id, w.id));
      expect(after).toMatchObject({ flagged: true });
      expect(after!.flagReason).toContain('donated went backwards');
    });

    it('keeps a flagged donor off the board', async () => {
      const w = await warmedUp();
      await setNickname(
        db,
        await requireSession(db, new Headers({ cookie: `${SESSION_COOKIE}=${w.token}` }), w.now),
        { nickname: 'Fraudador', password: 'senha-padrao' },
        w.now,
      );
      w.next.donated = w.next.lifetimeCoins;
      await sendNext(w);
      const top = await getDonorsTop(db, w.now);
      expect(top.entries.map((entry) => entry.nickname)).not.toContain('Fraudador');
    });
  });

  describe('the list', () => {
    it('orders by the total, whatever its size, with the title each total earns', async () => {
      await row({ nickname: 'Pequeno', ...gave(13.3, '2e+13') });
      await row({ nickname: 'Enorme', ...gave(93.5, '3.2e+93') });
      await row({ nickname: 'Medio', ...gave(34.1, '1.3e+34') });
      await row({ nickname: 'Nada' });
      const other = 'pablo';
      await row({ nickname: 'Avatar', ...gave(24, '1e+24'), avatarProfessor: other, avatarSkin: 'skin-x' });

      const top = await getDonorsTop(db, T0);
      expect(top.entries.map((entry) => [entry.rank, entry.nickname, entry.value, entry.title])).toEqual([
        [1, 'Enorme', '3.2e+93', 'nome-no-predio'],
        [2, 'Medio', '1.3e+34', 'patrocinador'],
        [3, 'Avatar', '1e+24', 'apoiador'],
        [4, 'Pequeno', '2e+13', 'voluntario'],
      ]);
      expect(top.entries[2]).toMatchObject({ professor: other, skin: 'skin-x' });
      expect(donorsResponseSchema.safeParse({ ...top, me: null }).success).toBe(true);
    });

    it('leaves out flagged, banned and test accounts and players with no nickname, exactly like the other boards', async () => {
      await row({ nickname: 'Honesta', ...gave(20) });
      for (const [nickname, extra] of [
        ['Marcada', { flagged: true }],
        ['Banida', { banned: true }],
        ['Teste', { testAccount: true }],
        [null, {}],
      ] as const) {
        await row({ nickname, ...extra, ...gave(99) });
      }
      const top = await getDonorsTop(db, T0);
      expect(top.entries.map((entry) => entry.nickname)).toEqual(['Honesta']);
    });

    it('lists at most 50', async () => {
      for (let i = 0; i < 55; i += 1) await row({ nickname: `J${i}`, ...gave(80 - i) });
      const top = await getDonorsTop(db, T0);
      expect(top.entries).toHaveLength(50);
      expect(top.entries[0]!.nickname).toBe('J0');
    });
  });

  describe("the caller's own row", () => {
    it('gives the true place, even past the 50, and nothing to an unranked or non-donor player', async () => {
      for (let i = 0; i < 52; i += 1) await row({ nickname: `J${i}`, ...gave(100 - i) });
      const me = await row({ nickname: 'Eu', ...gave(30, '1e+30') });
      expect(await donorsMe(db, me, T0)).toMatchObject({ rank: 53, nickname: 'Eu', value: '1e+30', title: 'apoiador' });

      const tied = await row({ nickname: 'Empate', ...gave(30, '1e+30') });
      // A tie is broken by the id, so the two take the places 53 and 54 between them.
      const ranks = [(await donorsMe(db, me, T0))?.rank, (await donorsMe(db, tied, T0))?.rank].sort();
      expect(ranks).toEqual([53, 54]);

      const flagged = await row({ nickname: 'Marcado', flagged: true, ...gave(30) });
      expect(await donorsMe(db, flagged, T0)).toBeNull();
      const none = await row({ nickname: 'SemDoacao' });
      expect(await donorsMe(db, none, T0)).toBeNull();
    });
  });
});
