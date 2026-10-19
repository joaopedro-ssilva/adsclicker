/** The Centro Comunitário board: who gave the campus the most ADScoins (docs/BACKEND.md, "Centro Comunitário"). */
import { sql } from 'drizzle-orm';
import { donationTitleFor, parseDecimal } from '@/game/engine';
import { professorIdSchema } from '@/shared/api';
import type { DonorRow, DonorsResponse } from '@/shared/api';
import type { Db } from '../db/client';
import { players, rankedCondition } from '../db/schema';
import type { PlayerCore } from '../players/summary';
import { isRanked } from '../players/summary';
import { getTagCatalog, publicTagsOf } from '../players/tags';
import { createTtlCache } from './cache';

/** The board lists this many. */
export const DONORS_BOARD_SIZE = 50;

/** Who is on the board: a ranked player (like every board) that gave something. */
const onBoard = () => sql`${rankedCondition()} and ${players.donatedLog} > 0`;

type Source = Pick<typeof players.$inferSelect, 'nickname' | 'titles' | 'avatarProfessor' | 'avatarSkin' | 'donatedText'>;

function toRow(rank: number, row: Source, catalog: Awaited<ReturnType<typeof getTagCatalog>>): DonorRow {
  const tags = publicTagsOf(catalog, row.titles);
  const professor = professorIdSchema.safeParse(row.avatarProfessor);
  return {
    rank,
    nickname: row.nickname ?? '',
    professor: professor.success ? professor.data : 'edecio',
    skin: row.avatarSkin,
    value: row.donatedText,
    title: donationTitleFor(parseDecimal(row.donatedText))?.id ?? null,
    ...(tags ? { tags } : {}),
  };
}

async function loadBoard(db: Db, now: number): Promise<DonorsResponse> {
  const [catalog, rows] = await Promise.all([
    getTagCatalog(db, now),
    db
      .select({
        nickname: players.nickname,
        titles: players.titles,
        avatarProfessor: players.avatarProfessor,
        avatarSkin: players.avatarSkin,
        donatedText: players.donatedText,
      })
      .from(players)
      .where(onBoard())
      .orderBy(sql`${players.donatedLog} desc nulls last`, sql`${players.id}`)
      .limit(DONORS_BOARD_SIZE),
  ]);
  return { updatedAt: now, entries: rows.map((row, index) => toRow(index + 1, row, catalog)), me: null };
}

/** Per-instance cache, one list per 10 s like the other boards. The caller's own row is added outside it. */
const boards = new Map<Db, ReturnType<typeof createTtlCache<DonorsResponse>>>();

export function getDonorsTop(db: Db, now: number = Date.now()): Promise<DonorsResponse> {
  let cache = boards.get(db);
  if (!cache) {
    cache = createTtlCache((_key, at) => loadBoard(db, at));
    boards.set(db, cache);
  }
  return cache.get('donors', now);
}

/** For tests. */
export function clearDonorsCache(): void {
  boards.clear();
}

/** The caller's row with their true place (players ahead of them plus one), or null when they are not on the board. */
export async function donorsMe(db: Db, player: PlayerCore, now: number = Date.now()): Promise<DonorRow | null> {
  if (!isRanked(player) || player.donatedLog <= 0) return null;
  const rows = await db.execute<{ ahead: number }>(
    sql`select count(*)::int as ahead from ${players} where ${onBoard()}
      and (${players.donatedLog} > ${player.donatedLog} or (${players.donatedLog} = ${player.donatedLog} and ${players.id} < ${player.id}))`,
  );
  const catalog = await getTagCatalog(db, now);
  return toRow((rows[0]?.ahead ?? 0) + 1, player, catalog);
}
