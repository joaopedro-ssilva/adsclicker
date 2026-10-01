import { count, desc, eq, getTableColumns, like, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { ONLINE_WINDOW_MS } from '@/shared/api';
import type { AdminPlayer, AdminPlayerPatch, AdminPlayerResponse, AdminPlayersResponse } from '@/shared/api';
import { getEventMultiplier } from '../config/eventMultiplier';
import type { Db } from '../db/client';
import { players } from '../db/schema';
import { ApiFailure } from '../http/errors';
import { nicknameKey } from '../players/nickname';
import type { PlayerCore } from '../players/summary';

export const ADMIN_PAGE_SIZE = 25;
export const ADMIN_FLAG_REASON = 'Marcado pelo admin';

export function toAdminPlayer(row: PlayerCore, selfId: string | null, now: number): AdminPlayer {
  return {
    id: row.id,
    nickname: row.nickname,
    hasPassword: row.passwordHash !== null,
    createdAt: row.createdAt.getTime(),
    lastSeenAt: row.lastSeenAt.getTime(),
    online: row.lastSeenAt.getTime() > now - ONLINE_WINDOW_MS,
    lifetimeCoins: row.lifetimeCoinsText,
    diplomasEarned: row.diplomasEarned,
    graduations: row.graduations,
    clicks: String(row.clicks),
    achievements: row.achievements,
    playSeconds: row.playSeconds,
    multiplier: row.multiplier,
    testAccount: row.testAccount,
    flagged: row.flagged,
    flagReason: row.flagReason,
    banned: row.banned,
    self: row.id === selfId,
  };
}

/** Escapes LIKE wildcards so a search for "100%" finds that text, not everything. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function searchCondition(search: string): SQL | undefined {
  const term = search.trim();
  if (term === '') return undefined;
  const byNickname = like(players.nicknameKey, `%${escapeLike(nicknameKey(term))}%`);
  // An id (or its first characters, as shown in the list) finds guests, who have no nickname.
  if (/^[0-9a-f-]{4,36}$/i.test(term)) {
    return or(byNickname, sql`${players.id}::text like ${`${escapeLike(term.toLowerCase())}%`}`);
  }
  return byNickname;
}

const { save: _save, ...listColumns } = getTableColumns(players);
void _save;

/** GET /api/admin/players: this browser's player first, then newest activity; `page` counts from 1. */
export async function listPlayers(
  db: Db,
  query: { search: string; page: number; selfId: string | null },
  now: number = Date.now(),
): Promise<AdminPlayersResponse> {
  const where = searchCondition(query.search);
  // The admin screen looks for the "self" row on the first page: this browser's player goes first when it matches.
  const order = [
    ...(query.selfId ? [sql`(${players.id} = ${query.selfId}::uuid) desc`] : []),
    desc(players.lastSeenAt),
    players.id,
  ];
  const [rows, totals, eventMultiplier] = await Promise.all([
    db
      .select(listColumns)
      .from(players)
      .where(where)
      .orderBy(...order)
      .limit(ADMIN_PAGE_SIZE)
      .offset((query.page - 1) * ADMIN_PAGE_SIZE),
    db.select({ total: count() }).from(players).where(where),
    getEventMultiplier(db, now),
  ]);
  return {
    players: rows.map((row) => toAdminPlayer(row, query.selfId, now)),
    total: totals[0]?.total ?? 0,
    page: query.page,
    pageSize: ADMIN_PAGE_SIZE,
    eventMultiplier,
  };
}

/** The columns an admin patch changes, with the rules of docs/BACKEND.md. */
export function patchToColumns(patch: AdminPlayerPatch): PgUpdateSetSource<typeof players> {
  const set: PgUpdateSetSource<typeof players> = {};
  if (patch.multiplier !== undefined) {
    set.multiplier = patch.multiplier;
    // Any multiplier other than 1 makes the account a test one, unless the same patch says otherwise.
    if (patch.multiplier !== 1 && patch.testAccount === undefined) set.testAccount = true;
  }
  if (patch.testAccount !== undefined) set.testAccount = patch.testAccount;
  if (patch.flagged !== undefined) {
    set.flagged = patch.flagged;
    set.flagReason = patch.flagged ? ADMIN_FLAG_REASON : null;
  }
  if (patch.banned !== undefined) set.banned = patch.banned;
  if (patch.clearNickname) {
    set.nickname = null;
    set.nicknameKey = null;
  }
  return set;
}

/** POST /api/admin/players/[id]. */
export async function patchPlayer(
  db: Db,
  id: string,
  patch: AdminPlayerPatch,
  selfId: string | null,
  now: number = Date.now(),
): Promise<AdminPlayerResponse> {
  if (!z.uuid().safeParse(id).success) throw new ApiFailure('not_found');
  const set = patchToColumns(patch);
  const rows =
    Object.keys(set).length === 0
      ? await db.select(listColumns).from(players).where(eq(players.id, id)).limit(1)
      : await db.update(players).set(set).where(eq(players.id, id)).returning(listColumns);
  const row = rows[0];
  if (!row) throw new ApiFailure('not_found');
  return { player: toAdminPlayer(row, selfId, now) };
}
