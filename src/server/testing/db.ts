import { sql } from 'drizzle-orm';
import { createDb } from '../db/client';
import type { Db } from '../db/client';
import { runMigrations } from '../db/migrate';

/** A throwaway database in the same Postgres as development. Never the real one: the name must end in `_test`. */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://adsclicker:adsclicker@localhost:5439/adsclicker_test';

export interface TestDb {
  db: Db;
  close: () => Promise<void>;
  /** Empties every table, so each test starts from nothing. */
  reset: () => Promise<void>;
}

/**
 * Connects to the test database and applies the migrations, or returns null when it cannot
 * (no Docker, no such database): integration tests then skip themselves.
 */
export async function connectTestDb(): Promise<TestDb | null> {
  if (!/_test(\?.*)?$/.test(TEST_DATABASE_URL)) throw new Error('TEST_DATABASE_URL must point at a database whose name ends in _test');
  const { sql: client, db } = createDb(TEST_DATABASE_URL, { max: 4 });
  try {
    await db.execute(sql`select 1`);
    await runMigrations(TEST_DATABASE_URL);
  } catch {
    await client.end({ timeout: 1 }).catch(() => undefined);
    return null;
  }
  return {
    db,
    close: () => client.end({ timeout: 5 }),
    reset: async () => {
      await db.execute(sql`truncate table players, sessions, feed_events, app_config, rate_limits cascade`);
    },
  };
}
