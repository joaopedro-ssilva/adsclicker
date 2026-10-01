import { sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { ONLINE_WINDOW_MS } from '@/shared/api';
import type { Board, LeaderboardResponse, RanksResponse } from '@/shared/api';
import { professorIdSchema } from '@/shared/api';
import type { PlayerCore } from '../players/summary';
import { isRanked } from '../players/summary';
import type { Db } from '../db/client';
import { players, rankedCondition } from '../db/schema';
import { createTtlCache } from './cache';

export const BOARD_SIZE = 100;

/** The column each board orders by; the partial indexes of the schema match these. */
const ORDER_COLUMN: Record<Board, AnyPgColumn> = {
  coins: players.lifetimeCoinsLog,
  diplomas: players.diplomasEarned,
  achievements: players.achievements,
  clicks: players.clicks,
};

type ValueColumns = Pick<typeof players.$inferSelect, 'lifetimeCoinsText' | 'diplomasEarned' | 'achievements' | 'clicks'>;

const boardValue = (board: Board, row: ValueColumns): string => {
  switch (board) {
    case 'coins':
      return row.lifetimeCoinsText;
    case 'diplomas':
      return String(row.diplomasEarned);
    case 'achievements':
      return String(row.achievements);
    case 'clicks':
      return String(row.clicks);
  }
};

async function loadBoard(db: Db, board: Board, now: number): Promise<LeaderboardResponse> {
  const column = ORDER_COLUMN[board];
  const rows = await db
    .select({
      nickname: players.nickname,
      lifetimeCoinsText: players.lifetimeCoinsText,
      diplomasEarned: players.diplomasEarned,
      achievements: players.achievements,
      clicks: players.clicks,
      avatarProfessor: players.avatarProfessor,
      avatarSkin: players.avatarSkin,
      lastSeenAt: players.lastSeenAt,
    })
    .from(players)
    .where(rankedCondition())
    // "desc nulls last" and the id tie-break spelled out, exactly as the index is declared.
    .orderBy(sql`${column} desc nulls last`, players.id)
    .limit(BOARD_SIZE);

  const onlineSince = now - ONLINE_WINDOW_MS;
  return {
    board,
    updatedAt: now,
    entries: rows.map((row, index) => {
      const professor = professorIdSchema.safeParse(row.avatarProfessor);
      return {
        rank: index + 1,
        nickname: row.nickname ?? '',
        value: boardValue(board, row),
        professor: professor.success ? professor.data : 'edecio',
        skin: row.avatarSkin,
        diplomas: row.diplomasEarned,
        achievements: row.achievements,
        online: row.lastSeenAt.getTime() > onlineSince,
      };
    }),
  };
}

/** Per-instance cache: one list per board per 10 s, shared by every request. */
const boards = new Map<Db, ReturnType<typeof createTtlCache<LeaderboardResponse>>>();

export function getLeaderboard(db: Db, board: Board, now: number = Date.now()): Promise<LeaderboardResponse> {
  let cache = boards.get(db);
  if (!cache) {
    cache = createTtlCache((key, at) => loadBoard(db, key as Board, at));
    boards.set(db, cache);
  }
  return cache.get(board, now);
}

/** For tests. */
export function clearLeaderboardCache(): void {
  boards.clear();
}

/** Position of a player on one board: the players ahead of them plus one. Ties break by id, like the list. */
async function rankOn(db: Db, board: Board, player: PlayerCore): Promise<number> {
  const column = ORDER_COLUMN[board];
  const mine = {
    coins: player.lifetimeCoinsLog,
    diplomas: player.diplomasEarned,
    achievements: player.achievements,
    clicks: player.clicks,
  }[board];
  // Two range counts instead of one OR: each can use the board's partial index.
  const rows = await db.execute<{ ahead: number }>(sql`
    select (
      (select count(*) from ${players} where ${rankedCondition()} and ${column} > ${mine})
      + (select count(*) from ${players} where ${rankedCondition()} and ${column} = ${mine} and ${players.id} < ${player.id})
    )::int as ahead`);
  return (rows[0]?.ahead ?? 0) + 1;
}

/** GET /api/me/ranks. Not cached: it is about one player. */
export async function getRanks(db: Db, player: PlayerCore): Promise<RanksResponse> {
  if (!isRanked(player)) return { ranks: { coins: null, diplomas: null, achievements: null, clicks: null } };
  const [coins, diplomas, achievements, clicks] = await Promise.all([
    rankOn(db, 'coins', player),
    rankOn(db, 'diplomas', player),
    rankOn(db, 'achievements', player),
    rankOn(db, 'clicks', player),
  ]);
  return { ranks: { coins, diplomas, achievements, clicks } };
}
