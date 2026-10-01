import { createHash, randomBytes } from 'node:crypto';
import { and, eq, getTableColumns, gt, lt, ne } from 'drizzle-orm';
import type { Db } from '../db/client';
import { players, sessions } from '../db/schema';
import type { PlayerRow } from '../db/schema';
import type { PlayerCore } from '../players/summary';

export const SESSION_COOKIE = 'adsclicker_session';
export const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000;
/**
 * "Renewed on every use" without a write on every request: the expiry moves forward (and the
 * cookie is sent again) when more than this much of the year has been used.
 */
export const RENEW_AFTER_MS = 24 * 60 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** 256 random bits. */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

/** The Set-Cookie value for a live session. */
export function sessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}; HttpOnly; SameSite=Lax${secure}`;
}

/** The Set-Cookie value that deletes the session cookie. */
export function clearedSessionCookie(): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
}

/** The raw token in a Cookie header, or null. */
export function readSessionToken(headers: Headers): string | null {
  const header = headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator > 0 && part.slice(0, separator).trim() === SESSION_COOKIE) {
      const value = part.slice(separator + 1).trim();
      return value.length > 0 && value.length <= 128 ? value : null;
    }
  }
  return null;
}

export interface SessionHit<P> {
  player: P;
  tokenHash: string;
  /** The expiry was pushed forward, so the cookie must be sent again. */
  renewed: boolean;
}

const { save: _save, ...coreColumns } = getTableColumns(players);
void _save;

async function renewIfDue(db: Db, tokenHash: string, expiresAt: Date, now: number): Promise<boolean> {
  if (SESSION_TTL_MS - (expiresAt.getTime() - now) < RENEW_AFTER_MS) return false;
  await db
    .update(sessions)
    .set({ expiresAt: new Date(now + SESSION_TTL_MS) })
    .where(eq(sessions.tokenHash, tokenHash));
  return true;
}

/** Session and player in one query, without the save text. */
export async function findSession(db: Db, token: string, now: number = Date.now()): Promise<SessionHit<PlayerCore> | null> {
  const tokenHash = hashToken(token);
  const [row] = await db
    .select({ player: coreColumns, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(players, eq(players.id, sessions.playerId))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date(now))))
    .limit(1);
  if (!row) return null;
  return { player: row.player, tokenHash, renewed: await renewIfDue(db, tokenHash, row.expiresAt, now) };
}

/** Same, with the save text: what the sync needs to judge and diff. */
export async function findSessionWithSave(db: Db, token: string, now: number = Date.now()): Promise<SessionHit<PlayerRow> | null> {
  const tokenHash = hashToken(token);
  const [row] = await db
    .select({ player: getTableColumns(players), expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(players, eq(players.id, sessions.playerId))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date(now))))
    .limit(1);
  if (!row) return null;
  return { player: row.player, tokenHash, renewed: await renewIfDue(db, tokenHash, row.expiresAt, now) };
}

type Executor = Pick<Db, 'insert'>;

/** Stores a new session and returns the token to put in the cookie (the only time it exists in clear). */
export async function createSession(executor: Executor, playerId: string, now: number = Date.now()): Promise<string> {
  const token = newToken();
  await executor.insert(sessions).values({
    tokenHash: hashToken(token),
    playerId,
    expiresAt: new Date(now + SESSION_TTL_MS),
  });
  return token;
}

export async function deleteSession(db: Db, tokenHash: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

/** Signs out every other device of the player (after a password change). */
export async function deleteOtherSessions(db: Db, playerId: string, keepTokenHash: string): Promise<void> {
  await db.delete(sessions).where(and(eq(sessions.playerId, playerId), ne(sessions.tokenHash, keepTokenHash)));
}

const SWEEP_EVERY_MS = 60 * 60 * 1000;
let lastSweep = 0;

/** Expired sessions are dead weight; delete them about once an hour per instance, without waiting. */
export function sweepExpiredSessionsLater(db: Db, now: number = Date.now()): void {
  if (now - lastSweep < SWEEP_EVERY_MS) return;
  lastSweep = now;
  void db
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date(now)))
    .catch(() => undefined);
}
