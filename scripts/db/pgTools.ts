/**
 * Shared by `npm run db:backup` and `npm run db:restore`: reads the database URL without ever printing it,
 * finds `pg_dump`/`pg_restore` (on the PATH, or through Docker with the official postgres image) and masks
 * the URL and the password in anything shown.
 *
 * The connection goes to the tools through PG* environment variables, so neither the URL nor the password
 * appears in a command line (and so not in `ps`, in Docker's arguments or in an error message).
 */
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';

/** The image used when the tools are not installed. Neon runs Postgres 16/17; a newer pg_dump reads older servers. */
export const DOCKER_IMAGE = 'postgres:17';

export interface Target {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
  /** libpq `sslmode`: whatever the URL says, else `prefer` (TLS when the server offers it, which Neon always does). */
  sslmode: string;
  channelBinding: string | undefined;
  /** The URL exactly as read: only used to mask it in messages. */
  raw: string;
}

/** Loads `.env.local` like src/server/db/migrate.ts when DATABASE_URL is not already in the environment. */
export function loadEnv(): void {
  if (!process.env.DATABASE_URL && existsSync('.env.local')) process.loadEnvFile('.env.local');
}

/**
 * The URL the tools use: `BACKUP_DATABASE_URL` when set, else `DATABASE_URL`. A Neon pooled host
 * (`ep-xxx-pooler.region.aws.neon.tech`, PgBouncer in transaction mode) is not meant for pg_dump/pg_restore,
 * so its `-pooler` is dropped to reach the direct host of the same database, unless `--keep-pooler` is given.
 */
export function readTarget(options: { keepPooler?: boolean } = {}): Target {
  loadEnv();
  const raw = process.env.BACKUP_DATABASE_URL || process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is not set (put it in .env.local or the environment).');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('The database URL is not a valid postgres:// URL (its value is not shown).');
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') throw new Error('The database URL must start with postgres:// or postgresql://.');
  let host = url.hostname;
  if (!options.keepPooler && /-pooler\./.test(host)) host = host.replace('-pooler.', '.');
  return {
    host,
    port: url.port || '5432',
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, '')) || 'postgres',
    sslmode: url.searchParams.get('sslmode') ?? 'prefer',
    channelBinding: url.searchParams.get('channel_binding') ?? undefined,
    raw,
  };
}

/** `ep-cool-123456.us-east-2.aws.neon.tech` becomes `ep-c***.aws.neon.tech`; a local host is shown as it is. */
export function maskHost(host: string): string {
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return host;
  const labels = host.split('.');
  if (labels.length < 3) return `${host.slice(0, 2)}***`;
  return [`${labels[0]!.slice(0, 4)}***`, ...labels.slice(-3)].join('.');
}

/** Removes the URL, the password (raw and URL-encoded) and the user from a text. */
export function mask(text: string, target: Target): string {
  let out = text;
  const secrets = [target.raw, target.password, encodeURIComponent(target.password)].filter((value) => value.length >= 3);
  for (const secret of secrets) out = out.split(secret).join('***');
  return out;
}

/** The libpq variables that describe the target. */
function pgEnv(target: Target, host: string): Record<string, string> {
  return {
    PGHOST: host,
    PGPORT: target.port,
    PGUSER: target.user,
    PGPASSWORD: target.password,
    PGDATABASE: target.database,
    PGSSLMODE: target.sslmode,
    ...(target.channelBinding ? { PGCHANNELBINDING: target.channelBinding } : {}),
    // Neon connects in a few hundred ms when warm, but a scaled-to-zero compute needs a few seconds.
    PGCONNECT_TIMEOUT: '30',
  };
}

interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

/** Runs a command; with stdoutFile its standard output is written to that file instead of being collected. */
function run(command: string, args: string[], env: NodeJS.ProcessEnv, stdoutFile?: string): Promise<RunResult> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, { env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    } catch {
      resolve({ code: null, stdout: '', stderr: '' });
      return;
    }
    let stdout = '';
    let stderr = '';
    const file = stdoutFile ? createWriteStream(stdoutFile) : null;
    if (file) child.stdout.pipe(file);
    else child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    const done = (code: number | null) => {
      if (!file || file.closed) return resolve({ code, stdout, stderr });
      // The pipe closes the file when the output ends, normally before the process reports its exit.
      file.once('close', () => resolve({ code, stdout, stderr }));
      file.end();
    };
    child.on('error', () => done(null));
    child.on('close', done);
  });
}

export type ToolName = 'pg_dump' | 'pg_restore';

/** True when the tool is installed and answers `--version`. */
async function onPath(tool: ToolName): Promise<boolean> {
  return (await run(tool, ['--version'], process.env)).code === 0;
}

async function dockerAvailable(): Promise<boolean> {
  return (await run('docker', ['version', '--format', '{{.Server.Version}}'], process.env)).code === 0;
}

/** A local Postgres is not at `localhost` from inside a container: Docker Desktop calls the machine `host.docker.internal`. */
const dockerHost = (host: string) => (host === 'localhost' || host === '127.0.0.1' || host === '::1' ? 'host.docker.internal' : host);

export interface RunTool {
  /** What was used, to tell the owner: `pg_dump from the PATH` or `Docker (postgres:17)`. */
  via: string;
  /**
   * Runs the tool against the target. `args` receives `mount`, which turns a host folder into a path the tool can use
   * (the folder itself, or its mount point inside the container). `stdoutFile` sends the tool's standard output to a file.
   */
  exec(args: (mount: Mounts) => string[], options?: { stdoutFile?: string }): Promise<RunResult>;
}

export interface Mount {
  host: string;
  readOnly: boolean;
}
export type Mounts = (mount: Mount) => string;

/**
 * Picks pg_dump/pg_restore from the PATH or, when it is not installed, Docker. `mount(host path)` inside `args`
 * gives the path to use for a folder: the folder itself without Docker, `/mnt/<n>` with it.
 */
export async function findTool(tool: ToolName, target: Target): Promise<RunTool> {
  if (await onPath(tool)) {
    return {
      via: `${tool} from the PATH`,
      exec: (args, options) => run(tool, args((mount) => mount.host), { ...process.env, ...pgEnv(target, target.host) }, options?.stdoutFile),
    };
  }
  if (!(await dockerAvailable())) {
    throw new Error(`${tool} is not on the PATH and Docker is not running. Install PostgreSQL client tools or start Docker Desktop.`);
  }
  return {
    via: `Docker (${DOCKER_IMAGE})`,
    exec: (args, options) => {
      const volumes: string[] = [];
      const paths: Mounts = (mount) => {
        const inside = `/mnt/${volumes.length}`;
        volumes.push('-v', `${mount.host}:${inside}${mount.readOnly ? ':ro' : ''}`);
        return inside;
      };
      const toolArgs = args(paths);
      const env = pgEnv(target, dockerHost(target.host));
      // `-e NAME` without a value takes it from this process's environment: nothing sensitive in the arguments.
      const envFlags = Object.keys(env).flatMap((name) => ['-e', name]);
      return run('docker', ['run', '--rm', ...envFlags, ...volumes, DOCKER_IMAGE, tool, ...toolArgs], { ...process.env, ...env }, options?.stdoutFile);
    },
  };
}
