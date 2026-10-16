import { sql } from 'drizzle-orm';
import { content } from '@/game/content';
import { readLabBuild } from '@/game/engine/lab/build';
import type { LabBoard, LabBoardRow, LabLeaderboardResponse } from '@/shared/api';
import type { Db } from '../db/client';
import { players, rankedCondition } from '../db/schema';
import type { PlayerCore } from '../players/summary';
import { isRanked } from '../players/summary';
import { getTagCatalog, publicTagsOf } from '../players/tags';
import { createTtlCache } from './cache';

/** The Laboratório boards list this many. */
export const LAB_BOARD_SIZE = 50;

/** Who is on a lab board: a ranked player (like every board) that actually has the record. */
const onBoard = (board: LabBoard) =>
  board === 'phase' ? sql`${rankedCondition()} and ${players.labBestPhase} > 0` : sql`${rankedCondition()} and ${players.bestRunCoinsLog} > 0`;

/** "desc nulls last", the tie-break and the id, spelled as the partial indexes of the schema declare them. */
const ordering = (board: LabBoard) =>
  board === 'phase'
    ? [sql`${players.labBestPhase} desc nulls last`, sql`${players.labBestPhaseAt} asc nulls last`, sql`${players.id}`]
    : [sql`${players.bestRunCoinsLog} desc nulls last`, sql`${players.id}`];

type Source = Pick<
  typeof players.$inferSelect,
  'nickname' | 'titles' | 'labBestPhase' | 'labBestPhaseBuild' | 'bestRunCoinsText' | 'bestRunBuild'
>;

function toRow(board: LabBoard, rank: number, row: Source, catalog: Awaited<ReturnType<typeof getTagCatalog>>): LabBoardRow {
  const tags = publicTagsOf(catalog, row.titles);
  // The build is read back through the content: ids the game no longer knows drop out, whatever the row holds.
  const build = readLabBuild(board === 'phase' ? row.labBestPhaseBuild : row.bestRunBuild, content);
  return {
    rank,
    nickname: row.nickname ?? '',
    value: board === 'phase' ? String(row.labBestPhase) : row.bestRunCoinsText,
    build,
    ...(tags ? { tags } : {}),
  };
}

async function loadBoard(db: Db, board: LabBoard, now: number): Promise<LabLeaderboardResponse> {
  const [catalog, rows] = await Promise.all([
    getTagCatalog(db, now),
    db
      .select({
        nickname: players.nickname,
        titles: players.titles,
        labBestPhase: players.labBestPhase,
        labBestPhaseBuild: players.labBestPhaseBuild,
        bestRunCoinsText: players.bestRunCoinsText,
        bestRunBuild: players.bestRunBuild,
      })
      .from(players)
      .where(onBoard(board))
      .orderBy(...ordering(board))
      .limit(LAB_BOARD_SIZE),
  ]);
  return { board, updatedAt: now, entries: rows.map((row, index) => toRow(board, index + 1, row, catalog)), me: null };
}

/** Per-instance cache, one list per board per 10 s like the other boards. The caller's own row is added outside it. */
const boards = new Map<Db, ReturnType<typeof createTtlCache<LabLeaderboardResponse>>>();

export function getLabLeaderboardTop(db: Db, board: LabBoard, now: number = Date.now()): Promise<LabLeaderboardResponse> {
  let cache = boards.get(db);
  if (!cache) {
    cache = createTtlCache((key, at) => loadBoard(db, key as LabBoard, at));
    boards.set(db, cache);
  }
  return cache.get(board, now);
}

/** For tests. */
export function clearLabLeaderboardCache(): void {
  boards.clear();
}

/** The caller's row with their true place (players ahead of them plus one), or null when they are not on the board. */
export async function labBoardMe(db: Db, board: LabBoard, player: PlayerCore, now: number = Date.now()): Promise<LabBoardRow | null> {
  if (!isRanked(player)) return null;
  const has = board === 'phase' ? player.labBestPhase > 0 : player.bestRunCoinsLog > 0;
  if (!has) return null;

  // Raw SQL does not format a Date: the instant goes in as text and is cast.
  const at = sql`${player.labBestPhaseAt ? player.labBestPhaseAt.toISOString() : null}::timestamptz`;
  const ahead =
    board === 'phase'
      ? sql`(${players.labBestPhase} > ${player.labBestPhase}
          or (${players.labBestPhase} = ${player.labBestPhase} and (
            ${players.labBestPhaseAt} < ${at}
            or (${players.labBestPhaseAt} is not distinct from ${at} and ${players.id} < ${player.id}))))`
      : sql`(${players.bestRunCoinsLog} > ${player.bestRunCoinsLog}
          or (${players.bestRunCoinsLog} = ${player.bestRunCoinsLog} and ${players.id} < ${player.id}))`;
  const rows = await db.execute<{ ahead: number }>(sql`select count(*)::int as ahead from ${players} where ${onBoard(board)} and ${ahead}`);
  const catalog = await getTagCatalog(db, now);
  return toRow(board, (rows[0]?.ahead ?? 0) + 1, player, catalog);
}
