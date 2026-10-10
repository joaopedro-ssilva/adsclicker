import { and, lt, sql } from 'drizzle-orm';
import { after } from 'next/server';
import { LOG_RETENTION_DAYS, LOG_RETENTION_MAX_ROWS } from '@/shared/api';
import type { LogLevel } from '@/shared/api';
import { databaseConfigured, getDb } from '../db/client';
import type { Db } from '../db/client';
import { serverLogs, trafficHourly, trafficHourlyPlayers } from '../db/schema';

/**
 * The server event log (docs/BACKEND.md, "Logs"). Rules:
 *  - logging never fails a request: every path swallows its own errors;
 *  - it never slows one: the write is scheduled with `after()` (or fired without waiting);
 *  - nothing sensitive goes in: see `redact`.
 */

export interface LogEntry {
  level: LogLevel;
  /** Short machine code, e.g. `server_error`, `login_failed`, `admin_ban`. */
  kind: string;
  message: string;
  playerId?: string | null;
  nickname?: string | null;
  route?: string | null;
  detail?: unknown;
}

const MESSAGE_MAX = 300;
const STRING_MAX = 300;
const DETAIL_MAX_CHARS = 4_000;
const NICKNAME_MAX = 40;
const ROUTE_MAX = 120;

/** Keys whose value is never stored, whatever it holds. */
const SENSITIVE_KEY = /pass|senha|token|cookie|secret|authorization|credential|hash|^ip$|ip_?addr|^save$|^phrase$/i;

/** A trimmed, JSON-safe copy of `detail` without secrets, addresses or saves. Exported for tests. */
export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.length > STRING_MAX ? `${value.slice(0, STRING_MAX)}…` : value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (depth >= 3) return '[…]';
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redact(item, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 30)) {
      out[key] = SENSITIVE_KEY.test(key) ? '[removido]' : redact(item, depth + 1);
    }
    return out;
  }
  return null;
}

function safeDetail(detail: unknown): unknown {
  if (detail === undefined) return null;
  const clean = redact(detail);
  return JSON.stringify(clean).length > DETAIL_MAX_CHARS ? { truncated: true } : clean;
}

/** Collapses a path to its shape: ids become `[id]`, the query string goes away. */
export function routeLabel(url: string): string {
  let path = url;
  try {
    path = new URL(url, 'http://local').pathname;
  } catch {
    // keep the raw text
  }
  return path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[id]').slice(0, ROUTE_MAX);
}

// --- Database outage: remembered in memory and written when the database answers again ----------

interface Outage {
  firstAt: number;
  lastAt: number;
  count: number;
  route: string | null;
}
let outage: Outage | null = null;

/** The database could not be reached. Nothing can be written now; the next successful write also records this. */
export function noteDatabaseDown(route: string | null, now: number = Date.now()): void {
  outage = outage
    ? { ...outage, lastAt: now, count: outage.count + 1, route: route ?? outage.route }
    : { firstAt: now, lastAt: now, count: 1, route };
}

// --- Writing ------------------------------------------------------------------------------------

/** Inserts one entry. Never throws. */
export async function writeLog(db: Db, entry: LogEntry, now: number = Date.now()): Promise<void> {
  try {
    const pending = outage;
    await db.insert(serverLogs).values({
      at: new Date(now),
      level: entry.level,
      kind: entry.kind.slice(0, 60),
      message: entry.message.slice(0, MESSAGE_MAX),
      playerId: entry.playerId ?? null,
      nickname: entry.nickname ? entry.nickname.slice(0, NICKNAME_MAX) : null,
      route: entry.route ? entry.route.slice(0, ROUTE_MAX) : null,
      detail: safeDetail(entry.detail),
    });
    if (pending && outage === pending) {
      outage = null;
      await db.insert(serverLogs).values({
        at: new Date(pending.lastAt),
        level: 'error',
        kind: 'db_unreachable',
        message: 'Banco de dados inacessível (registrado após a volta).',
        route: pending.route,
        detail: { since: new Date(pending.firstAt).toISOString(), until: new Date(pending.lastAt).toISOString(), failedRequests: pending.count },
      });
    }
    pruneLater(db, now);
  } catch {
    // Logging must never break anything.
  }
}

/** Runs `task` after the response when inside a request, otherwise right away without waiting. */
function runLater(task: () => Promise<void>): void {
  try {
    after(task);
  } catch {
    void task().catch(() => undefined);
  }
}

const recent = new Map<string, number>();

function throttled(key: string, ms: number, now: number): boolean {
  const last = recent.get(key);
  if (last !== undefined && now - last < ms) return true;
  if (recent.size > 200) recent.clear();
  recent.set(key, now);
  return false;
}

/** Off in the test suite, so unrelated tests never write rows; the helpers above are tested directly. */
const disabled = () => process.env.NODE_ENV === 'test';

/**
 * Records an event after the response. `throttleMs` keeps a flood (a refused client retrying) from
 * filling the table: the same `kind`+`route`+`throttleKey` is written at most once per window per instance.
 */
export function logEvent(db: Db, entry: LogEntry, options: { throttleMs?: number; throttleKey?: string } = {}): void {
  try {
    if (disabled()) return;
    const now = Date.now();
    if (options.throttleMs && throttled(`${entry.kind}|${entry.route ?? ''}|${options.throttleKey ?? ''}`, options.throttleMs, now)) return;
    runLater(() => writeLog(db, entry, now));
  } catch {
    // never throws
  }
}

/** Same, for code that has no `db` at hand (the route wrapper): uses the shared client, if configured. */
export function logEventAuto(entry: LogEntry, options: { throttleMs?: number; throttleKey?: string } = {}): void {
  try {
    if (disabled() || !databaseConfigured()) return;
    logEvent(getDb(), entry, options);
  } catch {
    // never throws
  }
}

// --- Traffic counters ---------------------------------------------------------------------------

const HOUR_MS = 60 * 60 * 1000;
let seenHour = 0;
const seenPlayers = new Set<string>();

/** Counts one sync outcome in the hourly row (and the player in that hour, once per instance). */
export async function recordTraffic(db: Db, input: { accepted: boolean; playerId?: string | null }, now: number = Date.now()): Promise<void> {
  try {
    const hour = new Date(Math.floor(now / HOUR_MS) * HOUR_MS);
    await db
      .insert(trafficHourly)
      .values({ hour, syncsAccepted: input.accepted ? 1 : 0, syncsRejected: input.accepted ? 0 : 1 })
      .onConflictDoUpdate({
        target: trafficHourly.hour,
        set: input.accepted
          ? { syncsAccepted: sql`${trafficHourly.syncsAccepted} + 1` }
          : { syncsRejected: sql`${trafficHourly.syncsRejected} + 1` },
      });
    if (input.playerId) {
      if (seenHour !== hour.getTime()) {
        seenHour = hour.getTime();
        seenPlayers.clear();
      }
      if (!seenPlayers.has(input.playerId)) {
        seenPlayers.add(input.playerId);
        await db.insert(trafficHourlyPlayers).values({ hour, playerId: input.playerId }).onConflictDoNothing();
      }
    }
  } catch {
    // never throws
  }
}

export function trackSync(db: Db, input: { accepted: boolean; playerId?: string | null }): void {
  try {
    if (disabled()) return;
    const now = Date.now();
    runLater(() => recordTraffic(db, input, now));
  } catch {
    // never throws
  }
}

// --- Retention ----------------------------------------------------------------------------------

const PRUNE_EVERY_MS = 10 * 60 * 1000;
let lastPrune = 0;

/** Deletes entries older than the retention and, beyond the row cap, the oldest ones. Never throws. */
export async function pruneLogs(db: Db, now: number = Date.now()): Promise<void> {
  try {
    const cutoff = new Date(now - LOG_RETENTION_DAYS * 24 * HOUR_MS);
    await db.delete(serverLogs).where(lt(serverLogs.at, cutoff));
    await db.execute(
      sql`delete from server_logs where id <= (select id from server_logs order by id desc offset ${LOG_RETENTION_MAX_ROWS} limit 1)`,
    );
    await db.delete(trafficHourly).where(lt(trafficHourly.hour, cutoff));
    await db.delete(trafficHourlyPlayers).where(and(lt(trafficHourlyPlayers.hour, cutoff)));
  } catch {
    // never throws
  }
}

function pruneLater(db: Db, now: number): void {
  if (now - lastPrune < PRUNE_EVERY_MS) return;
  lastPrune = now;
  void pruneLogs(db, now);
}

/** For tests. */
export function resetLogState(): void {
  outage = null;
  lastPrune = 0;
  recent.clear();
  seenPlayers.clear();
  seenHour = 0;
}

/** For tests. */
export function pendingOutage(): Outage | null {
  return outage;
}
