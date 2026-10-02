import { and, eq, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core';
import { content } from '@/game/content';
import { deserializeState, serializeState } from '@/game/engine';
import type { SyncRequest, SyncResponse } from '@/shared/api';
import { createGuest } from '../auth/guest';
import { findSessionWithSave, sessionCookie } from '../auth/session';
import { getEventMultiplier } from '../config/eventMultiplier';
import type { Db } from '../db/client';
import { feedEvents, players } from '../db/schema';
import type { PlayerRow } from '../db/schema';
import { ApiFailure } from '../http/errors';
import { RATE_RULES, consume } from '../http/rateLimit';
import { diffFeed } from './feed';
import { effectiveMultiplier } from './multiplier';
import { isRollback, judgeSave } from './plausibility';
import { coinsOutOfRange, projectState } from './projection';
import { isRanked, toCloudSave, toMe } from './summary';

export interface SyncInput {
  request: SyncRequest;
  /** Raw session token from the cookie, or null. */
  token: string | null;
  ip: string;
  now?: number;
}

export interface SyncResult {
  body: SyncResponse;
  /** Set-Cookie values for the response. */
  cookies: string[];
}

const FLAG_REASON_MAX = 200;

/**
 * POST /api/sync (docs/BACKEND.md): the lean path every open game takes every 45 s. Queries on a
 * normal sync: session+player (1), rate-limit counter (1), the update (1, plus a transaction
 * only when the feed has something to add), and the event multiplier from memory.
 */
export async function syncPlayer(db: Db, input: SyncInput): Promise<SyncResult> {
  const now = input.now ?? Date.now();
  const { request } = input;
  const cookies: string[] = [];

  // Judge the body before touching the database, so garbage never creates a guest.
  const parsed = deserializeState(request.save, content, now);
  if (!parsed || coinsOutOfRange(parsed)) throw new ApiFailure('invalid', 'O save enviado é inválido.');

  let player: PlayerRow;
  const hit = input.token ? await findSessionWithSave(db, input.token, now) : null;
  if (hit) {
    player = hit.player;
    if (hit.renewed && input.token) cookies.push(sessionCookie(input.token));
  } else {
    const guest = await createGuest(db, input.ip, now);
    player = guest.player;
    cookies.push(sessionCookie(guest.token));
  }

  await consume(db, RATE_RULES.sync, player.id, now);

  const eventMultiplier = await getEventMultiplier(db, now);
  const multiplier = effectiveMultiplier(eventMultiplier, player.multiplier);

  if (player.rev > request.baseRev && !request.force) {
    return { body: conflictBody(player, multiplier), cookies };
  }

  // The client's own multiplier is never trusted: the server's replaces it before anything is computed.
  parsed.settings.devMultiplier = multiplier;

  // A forced overwrite that goes back to older progress (the other device's save) has no baseline:
  // it is judged like a first sync, by its own play time. One that moves forward is judged as usual,
  // so `force` is not a way around the elapsed-time check.
  const stored = player.save !== null ? deserializeState(player.save, content, now) : null;
  const previous = stored && !(request.force && isRollback(stored, parsed)) ? stored : null;
  const verdict = judgeSave({ previous, next: parsed, elapsedMs: now - player.lastSeenAt.getTime() });

  const flagged = player.flagged || !verdict.ok;
  const flagReason = verdict.ok ? player.flagReason : verdict.reason.slice(0, FLAG_REASON_MAX);
  const ranked = isRanked({ ...player, flagged });
  const drafts = ranked ? diffFeed(previous, parsed) : [];

  const values = {
    save: serializeState(parsed),
    rev: sql`${players.rev} + 1`,
    lastSeenAt: new Date(now),
    flagged,
    flagReason,
    ...projectState(parsed),
  };
  const where = request.force ? eq(players.id, player.id) : and(eq(players.id, player.id), eq(players.rev, player.rev));

  const newRev = await writeSync(db, player.id, values, where, drafts);
  if (newRev === null) {
    // Another device synced between our read and our write: treat it as the conflict it is.
    const [fresh] = await db.select().from(players).where(eq(players.id, player.id)).limit(1);
    if (!fresh) throw new ApiFailure('unauthorized');
    return { body: conflictBody(fresh, multiplier), cookies };
  }

  const me = toMe({ ...player, flagged });
  return { body: { status: 'ok', rev: newRev, serverTime: now, multiplier, me }, cookies };
}

function conflictBody(player: PlayerRow, multiplier: number): SyncResponse {
  const cloud = toCloudSave(player);
  if (!cloud) throw new ApiFailure('internal');
  return { status: 'conflict', cloud, multiplier, me: toMe(player) };
}

async function writeSync(
  db: Db,
  playerId: string,
  values: PgUpdateSetSource<typeof players>,
  where: SQL | undefined,
  drafts: ReturnType<typeof diffFeed>,
): Promise<number | null> {
  if (drafts.length === 0) {
    const [row] = await db.update(players).set(values).where(where).returning({ rev: players.rev });
    return row?.rev ?? null;
  }
  return db.transaction(async (tx) => {
    const [row] = await tx.update(players).set(values).where(where).returning({ rev: players.rev });
    if (!row) return null;
    await tx
      .insert(feedEvents)
      .values(drafts.map((draft) => ({ playerId, kind: draft.kind, detail: draft.detail })))
      .onConflictDoNothing();
    return row.rev;
  });
}
