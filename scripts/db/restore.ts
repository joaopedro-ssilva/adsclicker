/**
 * `npm run db:restore -- <file.dump> --yes-i-know [--clean]`: restores a dump made by `npm run db:backup` into the
 * database in DATABASE_URL (or BACKUP_DATABASE_URL). For disaster recovery, and to copy production into a LOCAL test
 * database. Refuses to run without --yes-i-know, and always prints the target (host masked) first.
 *
 * Without --clean the target must not have the tables yet (restore into an empty database; an existing table makes the
 * restore stop with an error and, being a single transaction, change nothing). With --clean the dump's objects are
 * dropped and recreated first: the data in those tables is replaced.
 */
import { existsSync, statSync } from 'node:fs';
import { dirname, basename, resolve } from 'node:path';
import { findTool, maskHost, mask, readTarget } from './pgTools';

function usage(): never {
  console.error('Usage: npm run db:restore -- <file.dump> --yes-i-know [--clean] [--keep-pooler]');
  console.error('Restores into DATABASE_URL (or BACKUP_DATABASE_URL). Point it at an empty or scratch database unless you mean to replace data.');
  process.exit(1);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const file = args.find((arg) => !arg.startsWith('--'));
  if (!file) usage();
  const target = readTarget({ keepPooler: args.includes('--keep-pooler') });
  const clean = args.includes('--clean');
  const path = resolve(file);
  if (!existsSync(path) || !statSync(path).isFile()) {
    console.error(`File not found: ${file}`);
    process.exit(1);
  }

  console.log(`Target: database "${target.database}" on ${maskHost(target.host)} port ${target.port} (${target.sslmode})`);
  console.log(`Dump:   ${basename(path)} (${(statSync(path).size / 1024).toFixed(1)} KB)`);
  console.log(clean ? 'Mode:   --clean (the dump\'s tables are dropped and recreated: their data is replaced)' : 'Mode:   into an empty database (stops, changing nothing, if the tables exist)');
  if (!args.includes('--yes-i-know')) {
    console.error('\nRefusing to restore without --yes-i-know. Check the target above first, then repeat the command with that flag.');
    process.exit(1);
  }

  const tool = await findTool('pg_restore', target);
  console.log(`Restoring with ${tool.via}...`);
  const result = await tool.exec((mount) => [
    '--no-owner',
    '--no-privileges',
    '--single-transaction',
    '--exit-on-error',
    ...(clean ? ['--clean', '--if-exists'] : []),
    '--dbname',
    target.database,
    `${mount({ host: dirname(path), readOnly: true })}/${basename(path)}`,
  ]);
  if (result.code !== 0) {
    console.error(`pg_restore failed (exit ${result.code ?? 'not started'}):\n${mask(result.stderr.trim() || 'no output', target)}`);
    process.exit(1);
  }
  console.log('Restore finished.');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message.replace(/postgres(ql)?:\/\/\S+/g, 'postgres://***'));
  process.exit(1);
});
