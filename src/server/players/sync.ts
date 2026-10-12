import { and, eq, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core';
import { content } from '@/game/content';
import { deserializeState, serializeState } from '@/game/engine';
import type { CloudBonusPayload, SyncRequest, SyncResponse } from '@/shared/api';
import { createGuest } from '../auth/guest';
import { findSessionWithSave, sessionCookie } from '../auth/session';
import { getEventMultiplier } from '../config/eventMultiplier';
import { bonusOf, creditClassroom } from '../hackathon/classroom';
import type { HackathonDeps } from '../hackathon/deps';
import { sharedDeps } from '../hackathon/deps';
import { readProfileRow } from '../hackathon/store';
import type { Db } from '../db/client';
import { feedEvents, players } from '../db/schema';
import type { PlayerRow, PlayerTagRow } from '../db/schema';
import { ApiFailure } from '../http/errors';
import { logEvent, trackSync } from '../logs/log';
import { RATE_RULES, consume } from '../http/rateLimit';
import { diffFeed } from './feed';
import { effectiveMultiplier } from './multiplier';
import { isRollback, judgeSave } from './plausibility';
import { coinsOutOfRange, projectState } from './projection';
import { isRanked, toCloudSave, toMe } from './summary';
import { getTagCatalog } from './tags';

export interface SyncInput {
  request: SyncRequest;
  /** Raw session token from the cookie, or null. */
  token: string | null;
  ip: string;
  now?: number;
  /** Engine and content of the Hackathon link; the real ones unless a test passes its own. */
  hackathon?: HackathonDeps;
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
  const trace: { playerId: string | null } = { playerId: null };
  try {
    const result = await syncPlayerInner(db, input, trace);
    // Hourly counters only (no row per sync): "ok" is an accepted sync; conflict and reset wrote nothing.
    trackSync(db, { accepted: result.body.status === 'ok', playerId: trace.playerId });
    return result;
  } catch (error) {
    if (error instanceof ApiFailure && (error.code === 'invalid' || error.code === 'rate_limited')) {
      trackSync(db, { accepted: false, playerId: trace.playerId });
    }
    throw error;
  }
}

async function syncPlayerInner(db: Db, input: SyncInput, trace: { playerId: string | null }): Promise<SyncResult> {
  const now = input.now ?? Date.now();
  const { request } = input;
  const cookies: string[] = [];

  // Judge the body before touching the database, so garbage never creates a guest.
  const parsed = deserializeState(request.save, content, now);
  if (!parsed || coinsOutOfRange(parsed)) {
    logEvent(
      db,
      {
        level: 'warn',
        kind: 'sync_invalid_save',
        message: 'Save rejeitado como inválido.',
        route: '/api/sync',
        detail: { reason: parsed ? 'coins_out_of_range' : 'unreadable', saveChars: request.save.length },
      },
      { throttleMs: 30_000 },
    );
    throw new ApiFailure('invalid', 'O save enviado é inválido.');
  }

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

  trace.playerId = player.id;
  await consume(db, RATE_RULES.sync, player.id, now);

  const [eventMultiplier, catalog] = await Promise.all([getEventMultiplier(db, now), getTagCatalog(db, now)]);
  const multiplier = effectiveMultiplier(eventMultiplier, player.multiplier);

  // The Hackathon student (if any) decides the classroom bonus: one primary-key read.
  const hackathon = input.hackathon ?? sharedDeps();
  const student = await readProfileRow(db, player.id);
  const bonus = student ? bonusOf(student, hackathon) : undefined;

  // A device that holds another progress epoch than the account (a save from before the launch reset)
  // writes nothing: the ranking stays clean. It is told to start over (docs/BACKEND.md).
  if ((request.epoch ?? 0) !== player.progressEpoch) return { body: resetBody(player, multiplier, bonus, catalog), cookies };

  if (player.rev > request.baseRev && !request.force) {
    return { body: conflictBody(player, multiplier, bonus, catalog), cookies };
  }

  // The client's own multiplier and bonus are never trusted: the server's replace them before anything is computed.
  parsed.settings.devMultiplier = multiplier;
  parsed.cloudBonus = bonus ? { cargo: bonus.cargo, mentors: bonus.mentors } : { cargo: 1, mentors: {} };

  // A forced overwrite that goes back to older progress (the other device's save) has no baseline:
  // it is judged like a first sync, by its own play time. One that moves forward is judged as usual,
  // so `force` is not a way around the elapsed-time check.
  const stored = player.save !== null ? deserializeState(player.save, content, now) : null;
  const previous = stored && !(request.force && isRollback(stored, parsed)) ? stored : null;
  const verdict = judgeSave({ previous, next: parsed, elapsedMs: now - player.lastSeenAt.getTime() });

  if (!verdict.ok) {
    logEvent(db, {
      level: 'warn',
      kind: 'sync_suspect',
      message: `Jogador marcado como suspeito: ${verdict.reason.slice(0, 150)}`,
      playerId: player.id,
      nickname: player.nickname,
      route: '/api/sync',
      detail: { reason: verdict.reason.slice(0, FLAG_REASON_MAX), alreadyFlagged: player.flagged, force: Boolean(request.force) },
    });
  }
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
  // The epoch is part of the write: a reset that commits between our read and our write makes it match nothing.
  const sameEpoch = eq(players.progressEpoch, player.progressEpoch);
  const where = request.force
    ? and(eq(players.id, player.id), sameEpoch)
    : and(eq(players.id, player.id), eq(players.rev, player.rev), sameEpoch);

  const newRev = await writeSync(db, player.id, values, where, drafts);
  if (newRev === null) {
    // Another device synced between our read and our write: treat it as the conflict it is.
    const [fresh] = await db.select().from(players).where(eq(players.id, player.id)).limit(1);
    if (!fresh) throw new ApiFailure('unauthorized');
    if (fresh.progressEpoch !== player.progressEpoch) return { body: resetBody(fresh, multiplier, bonus, catalog), cookies };
    return { body: conflictBody(fresh, multiplier, bonus, catalog), cookies };
  }

  await creditClassroom(db, student, parsed.counters, hackathon, now);

  const me = toMe({ ...player, flagged }, catalog);
  return { body: { status: 'ok', rev: newRev, serverTime: now, multiplier, ...(bonus ? { bonus } : {}), me }, cookies };
}

function conflictBody(player: PlayerRow, multiplier: number, bonus: CloudBonusPayload | undefined, catalog: readonly PlayerTagRow[]): SyncResponse {
  const cloud = toCloudSave(player);
  if (!cloud) throw new ApiFailure('internal');
  return { status: 'conflict', cloud, multiplier, ...(bonus ? { bonus } : {}), me: toMe(player, catalog) };
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

function resetBody(player: PlayerRow, multiplier: number, bonus: CloudBonusPayload | undefined, catalog: readonly PlayerTagRow[]): SyncResponse {
  return { status: 'reset', epoch: player.progressEpoch, multiplier, ...(bonus ? { bonus } : {}), me: toMe(player, catalog) };
}
