/**
 * `npm run db:backup`: a full dump of the database in DATABASE_URL (or BACKUP_DATABASE_URL, see below) to
 * backups/adsclicker-<UTC date and time>.dump, in PostgreSQL custom format. Read-only on the database.
 * Uses pg_dump from the PATH or, if it is not installed, Docker with the official postgres image.
 * The URL and the password are never printed. Details in docs/BACKEND.md ("Backup e restauração").
 */
import { mkdirSync, renameSync, statSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { findTool, maskHost, mask, readTarget } from './pgTools';

const BACKUP_DIR = 'backups';

/** 2026-10-14T153012Z: sortable, no characters Windows refuses in a file name. */
function stamp(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[-:]/g, '').replace('T', '-');
}

function size(bytes: number): string {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function main(): Promise<void> {
  const target = readTarget({ keepPooler: process.argv.includes('--keep-pooler') });
  const dir = resolve(BACKUP_DIR);
  mkdirSync(dir, { recursive: true });
  const name = `adsclicker-${stamp(new Date())}.dump`;
  const partial = `${name}.partial`;

  const tool = await findTool('pg_dump', target);
  console.log(`Backing up database "${target.database}" on ${maskHost(target.host)} (${target.sslmode}) with ${tool.via}...`);
  // The dump goes through standard output into the file, so nothing needs to be mounted into a container.
  const result = await tool.exec(() => ['--format=custom', '--no-owner', '--no-privileges'], { stdoutFile: resolve(dir, partial) });

  if (result.code !== 0) {
    try {
      unlinkSync(resolve(dir, partial)); // (rmSync did not remove the file on this Windows setup; unlinkSync does)
    } catch {
      // already gone
    }
    const detail = mask(result.stderr.trim() || 'no output', target);
    console.error(`pg_dump failed (exit ${result.code ?? 'not started'}):\n${detail}`);
    if (/pooler|pgbouncer|prepared statement|unsupported/i.test(detail)) {
      console.error('Hint: use the direct (non-pooled) Neon host: set BACKUP_DATABASE_URL to the connection string without "-pooler".');
    }
    process.exit(1);
  }

  renameSync(resolve(dir, partial), resolve(dir, name));
  const bytes = statSync(resolve(dir, name)).size;
  console.log(`Backup written: ${BACKUP_DIR}/${name} (${size(bytes)})`);
  console.log('This file holds player data and password hashes: keep it private and never commit it.');
}

main().catch((error: unknown) => {
  // Only our own messages reach here (the URL is never part of them), but mask anyway.
  const message = error instanceof Error ? error.message : String(error);
  console.error(message.replace(/postgres(ql)?:\/\/\S+/g, 'postgres://***'));
  process.exit(1);
});
