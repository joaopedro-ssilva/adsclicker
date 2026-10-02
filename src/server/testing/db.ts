import { sql } from 'drizzle-orm';
import { createDb } from '../db/client';
import type { Db } from '../db/client';
import { runMigrations } from '../db/migrate';

/** A throwaway database in the same Postgres as development. Never the real one: the name must end in `_test`. */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://adsclicker:adsclicker@localhost:5439/adsclicker_test';

export interface TestDb {
  db: Db;
  url: string;
  close: () => Promise<void>;
  /** Empties every table, so each test starts from nothing. */
  reset: () => Promise<void>;
}

/** Name of a database in the same instance, so test files that truncate tables can run side by side. */
function urlFor(database: string | undefined): string {
  if (!database) return TEST_DATABASE_URL;
  if (!/^[a-z0-9_]+_test$/.test(database)) throw new Error('a test database name must be lower case and end in _test');
  const url = new URL(TEST_DATABASE_URL);
  url.pathname = `/${database}`;
  return url.toString();
}

/** Creates the database when it does not exist yet (connecting to the instance's maintenance database). */
async function ensureDatabase(database: string): Promise<void> {
  const maintenance = new URL(TEST_DATABASE_URL);
  maintenance.pathname = '/postgres';
  const { sql: client, db } = createDb(maintenance.toString(), { max: 1 });
  try {
    const found = await db.execute(sql`select 1 from pg_database where datname = ${database}`);
    if (found.length === 0) await db.execute(sql`create database ${sql.identifier(database)}`);
  } finally {
    await client.end({ timeout: 1 }).catch(() => undefined);
  }
}

/**
 * Connects to the test database and applies the migrations, or returns null when it cannot
 * (no Docker, no such database): integration tests then skip themselves. Files that run in
 * parallel with others pass their own `database` (created on demand).
 */
export async function connectTestDb(options: { database?: string } = {}): Promise<TestDb | null> {
  if (!/_test(\?.*)?$/.test(TEST_DATABASE_URL)) throw new Error('TEST_DATABASE_URL must point at a database whose name ends in _test');
  const url = urlFor(options.database);
  if (options.database) {
    try {
      await ensureDatabase(options.database);
    } catch {
      return null;
    }
  }
  const { sql: client, db } = createDb(url, { max: 4 });
  try {
    await db.execute(sql`select 1`);
    await runMigrations(url);
  } catch {
    await client.end({ timeout: 1 }).catch(() => undefined);
    return null;
  }
  return {
    db,
    url,
    close: () => client.end({ timeout: 5 }),
    reset: async () => {
      await db.execute(sql`truncate table players, sessions, feed_events, app_config, rate_limits cascade`);
    },
  };
}
