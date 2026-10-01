import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;

/** The backend is not configured or the database cannot be reached. Routes answer 503 for it. */
export class DatabaseUnavailableError extends Error {
  constructor(message = 'Database unavailable') {
    super(message);
    this.name = 'DatabaseUnavailableError';
  }
}

interface Cached {
  url: string;
  sql: postgres.Sql;
  db: Db;
}

// Cached on globalThis so a hot reload in development (and a warm serverless instance in
// production) reuses one pool instead of opening a new one per module evaluation.
const globalForDb = globalThis as typeof globalThis & { __adsclickerDb?: Cached };

export function createDb(url: string, options: { max?: number } = {}): { sql: postgres.Sql; db: Db } {
  const sql = postgres(url, {
    // Small on purpose: serverless instances multiply, and the managed pooler has its own limit.
    max: options.max ?? 3,
    idle_timeout: 20,
    connect_timeout: 5,
    // Transaction poolers (pgbouncer, Neon, Supabase) do not support named prepared statements.
    prepare: false,
    onnotice: () => undefined,
  });
  return { sql, db: drizzle(sql, { schema }) };
}

/** True when DATABASE_URL is set. Says nothing about whether the server is reachable. */
export function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** Lazily creates the client. Never connects by itself: the first query does. */
export function getDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) throw new DatabaseUnavailableError('DATABASE_URL is not set');
  const cached = globalForDb.__adsclickerDb;
  if (cached?.url === url) return cached.db;
  void cached?.sql.end({ timeout: 1 }).catch(() => undefined);
  const { sql, db } = createDb(url);
  globalForDb.__adsclickerDb = { url, sql, db };
  return db;
}

const CONNECTION_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
  'CONNECT_TIMEOUT',
  'CONNECTION_CLOSED',
  'CONNECTION_ENDED',
  'CONNECTION_DESTROYED',
  'CONNECTION_REFUSED',
  '57P01', // admin_shutdown
  '57P03', // cannot_connect_now
  '53300', // too_many_connections
  '28P01', // invalid_password
  '3D000', // database does not exist
]);

/** Walks the cause chain: Drizzle wraps the driver error in a DrizzleQueryError. */
export function isDatabaseDown(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current instanceof Error; depth += 1) {
    if (current instanceof DatabaseUnavailableError) return true;
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string' && CONNECTION_CODES.has(code)) return true;
    if (current instanceof AggregateError && current.errors.some((inner) => isDatabaseDown(inner))) return true;
    current = current.cause;
  }
  return false;
}

/** True for a Postgres unique-constraint violation (optionally on the named constraint/index). */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current instanceof Error; depth += 1) {
    const info = current as { code?: unknown; constraint_name?: unknown };
    if (info.code === '23505') return constraint === undefined || info.constraint_name === constraint;
    current = current.cause;
  }
  return false;
}
