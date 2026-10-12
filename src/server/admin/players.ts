import { count, desc, eq, getTableColumns, like, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { ONLINE_WINDOW_MS } from '@/shared/api';
import type { AdminPasswordResetResponse, AdminPlayer, AdminPlayerPatch, AdminPlayerResponse, AdminPlayersResponse } from '@/shared/api';
import { getEventMultiplier } from '../config/eventMultiplier';
import type { Db } from '../db/client';
import { hashPassword } from '../auth/password';
import { players, sessions } from '../db/schema';
import type { PlayerTagRow } from '../db/schema';
import { ApiFailure } from '../http/errors';
import { logEvent } from '../logs/log';
import { generateTempPassword } from './tempPassword';
import { nicknameKey } from '../players/nickname';
import { assertTagFree, grantTagSql, loadTags, requireTag, revokeTagSql, tagIdsOf } from '../players/tags';
import type { PlayerCore } from '../players/summary';

export const ADMIN_PAGE_SIZE = 25;
export const ADMIN_FLAG_REASON = 'Marcado pelo admin';

/** `catalog` is the tag catalogue: the ids of deleted tags are left out. */
export function toAdminPlayer(row: PlayerCore, selfId: string | null, now: number, catalog: readonly PlayerTagRow[]): AdminPlayer {
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
    trusted: row.trusted,
    self: row.id === selfId,
    tags: tagIdsOf(catalog, row.titles),
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
  const [rows, totals, eventMultiplier, catalog] = await Promise.all([
    db
      .select(listColumns)
      .from(players)
      .where(where)
      .orderBy(...order)
      .limit(ADMIN_PAGE_SIZE)
      .offset((query.page - 1) * ADMIN_PAGE_SIZE),
    db.select({ total: count() }).from(players).where(where),
    getEventMultiplier(db, now),
    loadTags(db),
  ]);
  return {
    players: rows.map((row) => toAdminPlayer(row, query.selfId, now, catalog)),
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
  if (patch.trusted !== undefined) {
    set.trusted = patch.trusted;
    // Trusting a player clears the flag they carry now, unless the same patch sets it.
    if (patch.trusted && patch.flagged === undefined) {
      set.flagged = false;
      set.flagReason = null;
    }
  }
  if (patch.clearNickname) {
    set.nickname = null;
    set.nicknameKey = null;
  }
  if (patch.grantTag !== undefined) set.titles = grantTagSql(patch.grantTag);
  else if (patch.revokeTag !== undefined) set.titles = revokeTagSql(patch.revokeTag);
  return set;
}

/** One log entry per kind of change in an admin patch. */
function logAdminPatch(db: Db, id: string, patch: AdminPlayerPatch, nickname: string | null, tagLabel: string | null): void {
  const changes: [string, string, unknown][] = [];
  if (patch.banned !== undefined) changes.push([patch.banned ? 'admin_ban' : 'admin_unban', patch.banned ? 'Jogador banido' : 'Banimento removido', null]);
  if (patch.flagged !== undefined) {
    changes.push([patch.flagged ? 'admin_flag' : 'admin_unflag', patch.flagged ? 'Marca de suspeito colocada' : 'Marca de suspeito removida', null]);
  }
  if (patch.trusted !== undefined) {
    changes.push([patch.trusted ? 'admin_trust' : 'admin_untrust', patch.trusted ? 'Marcado como confiável (o anticheat não marca mais)' : 'Marca de confiável removida', null]);
  }
  if (patch.multiplier !== undefined) changes.push(['admin_multiplier', `Multiplicador do jogador: ×${patch.multiplier}`, { multiplier: patch.multiplier }]);
  if (patch.testAccount !== undefined) changes.push(['admin_test_account', patch.testAccount ? 'Marcado como conta de teste' : 'Conta de teste desmarcada', null]);
  if (patch.clearNickname) changes.push(['admin_clear_nickname', 'Apelido removido', null]);
  if (patch.grantTag !== undefined) changes.push(['admin_tag_grant', `Tag dada: ${tagLabel ?? patch.grantTag}`, { tag: patch.grantTag }]);
  if (patch.revokeTag !== undefined) changes.push(['admin_tag_revoke', `Tag tirada: ${tagLabel ?? patch.revokeTag}`, { tag: patch.revokeTag }]);
  for (const [kind, message, detail] of changes) {
    logEvent(db, { level: 'info', kind, message, playerId: id, nickname, route: '/api/admin/players/[id]', detail });
  }
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
  if (patch.grantTag !== undefined && patch.revokeTag !== undefined) {
    throw new ApiFailure('invalid', 'Dê ou tire uma tag por vez.');
  }
  let tagLabel: string | null = null;
  if (patch.grantTag !== undefined) {
    const tag = await requireTag(db, patch.grantTag);
    await assertTagFree(db, tag, id);
    tagLabel = tag.label;
  }
  // Taking away the id of a deleted tag is harmless (it is already gone from everyone), so no check.
  const set = patchToColumns(patch);
  const rows =
    Object.keys(set).length === 0
      ? await db.select(listColumns).from(players).where(eq(players.id, id)).limit(1)
      : await db.update(players).set(set).where(eq(players.id, id)).returning(listColumns);
  const row = rows[0];
  if (!row) throw new ApiFailure('not_found');
  logAdminPatch(db, id, patch, row.nickname, tagLabel);
  return { player: toAdminPlayer(row, selfId, now, await loadTags(db)) };
}

/**
 * POST /api/admin/players/[id]/password-reset: gives a player who lost the password a new, temporary
 * one. It is stored hashed like any other, every session of the player is revoked, and the clear
 * text is returned this once. It is never logged. A guest (no nickname) has nothing to log in with.
 */
export async function resetPlayerPassword(db: Db, id: string, selfId: string | null, now: number = Date.now()): Promise<AdminPasswordResetResponse> {
  if (!z.uuid().safeParse(id).success) throw new ApiFailure('not_found');
  const temporaryPassword = generateTempPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const row = await db.transaction(async (tx) => {
    const found = (await tx.select(listColumns).from(players).where(eq(players.id, id)).limit(1))[0];
    if (!found) throw new ApiFailure('not_found');
    if (found.nickname === null) throw new ApiFailure('invalid', 'Só dá para redefinir a senha de quem tem apelido.');
    const updated = await tx.update(players).set({ passwordHash }).where(eq(players.id, id)).returning(listColumns);
    await tx.delete(sessions).where(eq(sessions.playerId, id));
    return updated[0] ?? found;
  });
  logEvent(db, {
    level: 'info',
    kind: 'admin_password_reset',
    message: `Senha redefinida pelo admin: ${row.nickname}`,
    playerId: id,
    nickname: row.nickname,
    route: '/api/admin/players/[id]/password-reset',
  });
  return { player: toAdminPlayer(row, selfId, now, await loadTags(db)), temporaryPassword };
}
