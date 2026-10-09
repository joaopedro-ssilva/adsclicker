import { and, isNotNull, ne, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { AdminTurmaZeroPreview, AdminTurmaZeroResult } from '@/shared/api';
import { sortTitles, titleById } from '@/shared/titles';
import type { TitleId } from '@/shared/titles';
import type { Db } from '../db/client';
import { players } from '../db/schema';
import { ApiFailure } from '../http/errors';

export const TURMA_ZERO: TitleId = 'turma-zero';

/** The ids to put on the wire: only titles the catalogue knows, highest priority first. */
export function titleIdsOf(held: readonly string[] | null | undefined): string[] {
  return sortTitles(held).map((title) => title.id);
}

/** Same, or undefined when there are none, so a player without titles adds nothing to a payload. */
export function titlesForWire(held: readonly string[] | null | undefined): string[] | undefined {
  const ids = titleIdsOf(held);
  return ids.length > 0 ? ids : undefined;
}

/** `titles` after granting `id`: unchanged when already held. Idempotent. */
export const grantTitleSql = (id: string): SQL =>
  sql`case when ${id}::text = any(${players.titles}) then ${players.titles} else array_append(${players.titles}, ${id}::text) end`;

/** `titles` after taking `id` away. Idempotent. */
export const revokeTitleSql = (id: string): SQL => sql`array_remove(${players.titles}, ${id}::text)`;

/**
 * Turma Zero is for the accounts that played the test phase: a nickname (so they are on the
 * boards) and at least one accepted sync (`rev > 0`, so they played).
 */
const testPhaseAccount = () => and(isNotNull(players.nickname), sql`${players.rev} > 0`);

const holds = (id: string) => sql`${id}::text = any(${players.titles})`;

/** Throws when granting `id` would give a single-holder title to a second player. */
export async function assertTitleFree(db: Db, id: string, playerId: string): Promise<void> {
  if (!titleById(id)?.single) return;
  const [holder] = await db
    .select({ nickname: players.nickname, id: players.id })
    .from(players)
    .where(and(holds(id), ne(players.id, playerId)))
    .limit(1);
  if (holder) {
    const who = holder.nickname ?? holder.id.slice(0, 8);
    throw new ApiFailure('invalid', `O título "${titleById(id)?.label ?? id}" já pertence a ${who}. Remova-o dele antes.`);
  }
}

/** What "Dar Turma Zero a todos os jogadores atuais" would do right now. */
export async function turmaZeroPreview(db: Db): Promise<AdminTurmaZeroPreview> {
  const [row] = await db
    .select({
      eligible: sql<number>`count(*)::int`,
      alreadyHave: sql<number>`(count(*) filter (where ${holds(TURMA_ZERO)}))::int`,
    })
    .from(players)
    .where(testPhaseAccount());
  const eligible = row?.eligible ?? 0;
  const alreadyHave = row?.alreadyHave ?? 0;
  return { eligible, alreadyHave, toGrant: eligible - alreadyHave };
}

/** Gives Turma Zero to every eligible account that lacks it, in one statement. Safe to repeat: a second run grants 0. */
export async function grantTurmaZeroToAll(db: Db): Promise<AdminTurmaZeroResult> {
  const granted = await db
    .update(players)
    .set({ titles: grantTitleSql(TURMA_ZERO) })
    .where(and(testPhaseAccount(), sql`not ${holds(TURMA_ZERO)}`))
    .returning({ id: players.id });
  const after = await turmaZeroPreview(db);
  return { granted: granted.length, alreadyHad: Math.max(0, after.alreadyHave - granted.length) };
}

/** Accounts eligible for Turma Zero that do not hold it (shown as a warning before the launch reset, which resets `rev`). */
export async function countWithoutTurmaZero(db: Pick<Db, 'select'>): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(players)
    .where(and(testPhaseAccount(), sql`not ${holds(TURMA_ZERO)}`));
  return row?.n ?? 0;
}
