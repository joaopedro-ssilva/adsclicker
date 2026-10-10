import { and, desc, eq, gte, ilike, lt, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { FEED_KINDS, LOG_LEVELS, LOG_RETENTION_DAYS, LOG_RETENTION_MAX_ROWS } from '@/shared/api';
import type { AdminActivityResponse, AdminLogsResponse, AdminTrafficHour, LogLevel, LogRange } from '@/shared/api';
import type { Db } from '../db/client';
import { feedEvents, players, serverLogs, trafficHourly, trafficHourlyPlayers } from '../db/schema';

export const LOGS_PAGE_SIZE = 50;
export const LOGS_MAX_PAGE_SIZE = 200;

const HOUR_MS = 60 * 60 * 1000;
const RANGE_MS: Record<Exclude<LogRange, 'all'>, number> = { '1h': HOUR_MS, '24h': 24 * HOUR_MS, '7d': 7 * 24 * HOUR_MS };

/** Start of a range, or null for "tudo". */
export function sinceOf(range: LogRange, now: number): Date | null {
  return range === 'all' ? null : new Date(now - RANGE_MS[range]);
}

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export interface LogsQuery {
  range: LogRange;
  level?: LogLevel;
  kind?: string;
  q?: string;
  /** Id of the last entry of the previous page. */
  before?: number;
  limit?: number;
}

/** The last 24 hours of traffic, oldest first, with the distinct players of each hour. */
export async function trafficLast24h(db: Db, now: number): Promise<AdminTrafficHour[]> {
  const since = new Date(Math.floor(now / HOUR_MS) * HOUR_MS - 23 * HOUR_MS);
  const [rows, distinct] = await Promise.all([
    db.select().from(trafficHourly).where(gte(trafficHourly.hour, since)),
    db
      .select({ hour: trafficHourlyPlayers.hour, n: sql<number>`count(*)::int` })
      .from(trafficHourlyPlayers)
      .where(gte(trafficHourlyPlayers.hour, since))
      .groupBy(trafficHourlyPlayers.hour),
  ]);
  const playersByHour = new Map(distinct.map((row) => [row.hour.getTime(), row.n]));
  return rows
    .map((row) => ({
      hour: row.hour.getTime(),
      accepted: row.syncsAccepted,
      rejected: row.syncsRejected,
      players: playersByHour.get(row.hour.getTime()) ?? 0,
    }))
    .sort((a, b) => a.hour - b.hour);
}

/** GET /api/admin/logs: newest first, filtered, one page. */
export async function queryLogs(db: Db, query: LogsQuery, now: number = Date.now()): Promise<AdminLogsResponse> {
  const limit = Math.min(Math.max(query.limit ?? LOGS_PAGE_SIZE, 1), LOGS_MAX_PAGE_SIZE);
  const since = sinceOf(query.range, now);
  const inRange = since ? gte(serverLogs.at, since) : undefined;

  const conditions: (SQL | undefined)[] = [inRange];
  if (query.level && (LOG_LEVELS as readonly string[]).includes(query.level)) conditions.push(eq(serverLogs.level, query.level));
  if (query.kind) conditions.push(eq(serverLogs.kind, query.kind));
  const term = query.q?.trim();
  if (term) {
    const like = `%${escapeLike(term)}%`;
    conditions.push(or(ilike(serverLogs.message, like), ilike(serverLogs.nickname, like), ilike(serverLogs.route, like)));
  }
  if (query.before !== undefined) conditions.push(lt(serverLogs.id, query.before));

  const [rows, kindRows, traffic] = await Promise.all([
    db
      .select()
      .from(serverLogs)
      .where(and(...conditions))
      .orderBy(desc(serverLogs.id))
      .limit(limit + 1),
    db.select({ kind: serverLogs.kind }).from(serverLogs).where(inRange).groupBy(serverLogs.kind).orderBy(serverLogs.kind).limit(100),
    trafficLast24h(db, now),
  ]);

  const page = rows.slice(0, limit);
  return {
    entries: page.map((row) => ({
      id: row.id,
      at: row.at.getTime(),
      level: (LOG_LEVELS as readonly string[]).includes(row.level) ? (row.level as LogLevel) : 'info',
      kind: row.kind,
      message: row.message,
      playerId: row.playerId,
      nickname: row.nickname,
      route: row.route,
      detail: row.detail ?? null,
    })),
    nextBefore: rows.length > limit ? (page[page.length - 1]?.id ?? null) : null,
    kinds: kindRows.map((row) => row.kind),
    traffic,
    retentionDays: LOG_RETENTION_DAYS,
    maxRows: LOG_RETENTION_MAX_ROWS,
    serverTime: now,
  };
}

// --- Class activity (the feed_events table, whole) ---------------------------------------------------------

export interface ActivityQuery {
  range: LogRange;
  kind?: string;
  /** Nickname search. */
  q?: string;
  /** `<epoch ms>_<event id>` of the last row of the previous page. */
  before?: string;
  limit?: number;
}

/** Event time at millisecond precision, the same the browser gets, so the paging cursor loses nothing. */
const eventMs = sql`date_trunc('milliseconds', ${feedEvents.createdAt})`;

/** GET /api/admin/activity: every feed event, newest first (not only the 30 the game shows). */
export async function queryActivity(db: Db, query: ActivityQuery, now: number = Date.now()): Promise<AdminActivityResponse> {
  const limit = Math.min(Math.max(query.limit ?? LOGS_PAGE_SIZE, 1), LOGS_MAX_PAGE_SIZE);
  const since = sinceOf(query.range, now);
  const conditions: (SQL | undefined)[] = [since ? gte(feedEvents.createdAt, since) : undefined];
  if (query.kind && (FEED_KINDS as readonly string[]).includes(query.kind)) conditions.push(eq(feedEvents.kind, query.kind));
  const term = query.q?.trim();
  if (term) conditions.push(ilike(players.nickname, `%${escapeLike(term)}%`));
  const cursor = /^(\d{1,15})_([0-9a-f-]{36})$/i.exec(query.before ?? '');
  if (cursor) {
    const at = new Date(Number(cursor[1])).toISOString();
    conditions.push(sql`(${eventMs}, ${feedEvents.id}) < (${at}::timestamptz, ${cursor[2]}::uuid)`);
  }

  const rows = await db
    .select({
      id: feedEvents.id,
      at: feedEvents.createdAt,
      playerId: feedEvents.playerId,
      nickname: players.nickname,
      kind: feedEvents.kind,
      detail: feedEvents.detail,
    })
    .from(feedEvents)
    .innerJoin(players, eq(players.id, feedEvents.playerId))
    .where(and(...conditions))
    .orderBy(sql`${eventMs} desc`, desc(feedEvents.id))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    entries: page.map((row) => ({
      id: row.id,
      at: row.at.getTime(),
      playerId: row.playerId,
      nickname: row.nickname,
      kind: row.kind,
      detail: row.detail === '' ? null : row.detail,
    })),
    nextBefore: rows.length > limit && last ? `${last.at.getTime()}_${last.id}` : null,
    retentionDays: LOG_RETENTION_DAYS,
    maxRows: LOG_RETENTION_MAX_ROWS,
    serverTime: now,
  };
}
