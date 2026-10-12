import { or, sql } from 'drizzle-orm';
import { LAUNCH_RESET_PHRASE } from '@/shared/api';
import type { AdminLaunchResetPreview, AdminLaunchResetResult } from '@/shared/api';
import { clearCommunityCache } from '../community/community';
import { clearLeaderboardCache } from '../community/leaderboard';
import type { Db } from '../db/client';
import { feedEvents, players } from '../db/schema';
import { ApiFailure } from '../http/errors';
import { logEvent } from '../logs/log';
import { bumpProgressEpoch, readProgressEpoch } from './progressEpoch';
import { countWithoutTurmaZero } from './tags';

/** The Hackathon tables the launch reset empties (docs/HACKATHON.md: parked, only tested). */
const HACKATHON_TABLES = {
  hackathonProfiles: 'hackathon_profiles',
  hackathonItems: 'hackathon_items',
  hackathonRuns: 'hackathon_runs',
  hackathonStages: 'hackathon_stages',
  hackathonCollection: 'hackathon_collection',
} as const;

/** The progress columns at their defaults: what a player who never played looks like. */
const BLANK_PROGRESS = {
  save: null,
  rev: 0,
  lifetimeCoinsText: '0',
  lifetimeCoins: '0',
  lifetimeCoinsLog: 0,
  diplomasEarned: 0,
  graduations: 0,
  clicks: 0,
  achievements: 0,
  professors: 1,
  playSeconds: 0,
  avatarProfessor: 'edecio',
  avatarSkin: '',
  // Test-phase flags: the plausibility check starts over with the first sync of the real game.
  flagged: false,
  flagReason: null,
} as const;

/** True for a player whose row differs from BLANK_PROGRESS: what the reset has something to clear in. */
const hasProgress = () =>
  or(
    sql`${players.save} is not null`,
    sql`${players.rev} <> 0`,
    sql`${players.lifetimeCoinsLog} <> 0`,
    sql`${players.diplomasEarned} <> 0`,
    sql`${players.graduations} <> 0`,
    sql`${players.clicks} <> 0`,
    sql`${players.achievements} <> 0`,
    sql`${players.professors} <> 1`,
    sql`${players.playSeconds} <> 0`,
    sql`${players.avatarProfessor} <> 'edecio'`,
    sql`${players.avatarSkin} <> ''`,
    sql`${players.flagged}`,
    sql`${players.flagReason} is not null`,
  );

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

async function countRows(db: Pick<Db, 'execute'>, table: string): Promise<number> {
  const rows = await db.execute<{ n: number }>(sql`select count(*)::int as n from ${sql.identifier(table)}`);
  return rows[0]?.n ?? 0;
}

async function deleteAll(tx: Tx, table: string): Promise<number> {
  const rows = await tx.execute<{ n: number }>(
    sql`with gone as (delete from ${sql.identifier(table)} returning 1) select count(*)::int as n from gone`,
  );
  return rows[0]?.n ?? 0;
}

/** What the reset would touch right now (GET /api/admin/launch-reset). */
export async function previewLaunchReset(db: Db): Promise<AdminLaunchResetPreview> {
  const [withProgress] = await db.select({ n: sql<number>`count(*)::int` }).from(players).where(hasProgress());
  const hackathon = await Promise.all(Object.values(HACKATHON_TABLES).map((table) => countRows(db, table)));
  return {
    epoch: await readProgressEpoch(db),
    players: withProgress?.n ?? 0,
    feedEvents: await countRows(db, 'feed_events'),
    hackathonRows: hackathon.reduce((sum, n) => sum + n, 0),
    withoutTurmaZero: await countWithoutTurmaZero(db),
  };
}

/**
 * "Zerar progresso para o lançamento" (docs/BACKEND.md). In ONE transaction:
 *  - every player: cloud save, revision, progress summary (the board columns), avatar and the
 *    test-phase suspect flag go back to a player who never played, and the account moves to the
 *    new progress epoch;
 *  - the activity feed is emptied (the community totals are sums over players, so they follow);
 *  - the Hackathon progress is emptied (profiles, items, runs, stages, collection);
 *  - the epoch is bumped, so a device that still holds a pre-reset save is refused by the sync.
 * Kept: accounts, nicknames, passwords, sessions, titles, moderation marks (test account,
 * multiplier, ban), the global event multiplier and the rate limit counters.
 *
 * Safe to run twice: the second run clears nothing more (it reports 0 players with progress) and
 * only moves the epoch one further, which also resets any device that has played in between.
 */
export async function resetForLaunch(db: Db, phrase: string, now: number = Date.now()): Promise<AdminLaunchResetResult> {
  if (phrase.trim() !== LAUNCH_RESET_PHRASE) {
    throw new ApiFailure('invalid', `Frase de confirmação incorreta. Digite exatamente: ${LAUNCH_RESET_PHRASE}`);
  }

  const result = await db.transaction(async (tx) => {
    const [withProgress] = await tx.select({ n: sql<number>`count(*)::int` }).from(players).where(hasProgress());
    const epoch = await bumpProgressEpoch(tx, now);
    const accounts = await tx
      .update(players)
      .set({ ...BLANK_PROGRESS, progressEpoch: epoch })
      .returning({ id: players.id });
    const feed = await tx.delete(feedEvents).returning({ id: feedEvents.id });
    const counts: Record<keyof typeof HACKATHON_TABLES, number> = {
      hackathonProfiles: 0,
      hackathonItems: 0,
      hackathonRuns: 0,
      hackathonStages: 0,
      hackathonCollection: 0,
    };
    for (const key of Object.keys(HACKATHON_TABLES) as (keyof typeof HACKATHON_TABLES)[]) {
      counts[key] = await deleteAll(tx, HACKATHON_TABLES[key]);
    }
    return {
      epoch,
      accounts: accounts.length,
      playersWithProgress: withProgress?.n ?? 0,
      feedEvents: feed.length,
      ...counts,
    };
  });

  // This instance's 10 s caches would keep showing the old boards for a few seconds.
  clearLeaderboardCache();
  clearCommunityCache();
  logEvent(db, {
    level: 'warn',
    kind: 'admin_launch_reset',
    message: `Reset de lançamento: época ${result.epoch}, ${result.accounts} contas.`,
    route: '/api/admin/launch-reset',
    detail: result,
  });
  return {
    epoch: result.epoch,
    players: result.accounts,
    playersWithProgress: result.playersWithProgress,
    feedEvents: result.feedEvents,
    hackathonProfiles: result.hackathonProfiles,
    hackathonItems: result.hackathonItems,
    hackathonRuns: result.hackathonRuns,
    hackathonStages: result.hackathonStages,
    hackathonCollection: result.hackathonCollection,
  };
}
