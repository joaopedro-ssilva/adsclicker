/**
 * Applies the SQL migrations in drizzle/ to DATABASE_URL (loaded from .env.local when the
 * variable is not already set). Run with `npm run db:migrate`.
 */
import { existsSync } from 'node:fs';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDb } from './client';

export const MIGRATIONS_FOLDER = 'drizzle';

export async function runMigrations(url: string): Promise<void> {
  const { sql, db } = createDb(url, { max: 1 });
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL && existsSync('.env.local')) process.loadEnvFile('.env.local');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set (put it in .env.local or the environment).');
  await runMigrations(url);
  console.log('Migrations applied.');
}

// Only when run directly (tsx), not when imported by a test.
if (process.argv[1] && /migrate\.ts$/.test(process.argv[1])) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
