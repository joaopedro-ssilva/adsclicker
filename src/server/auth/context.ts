import type { Db } from '../db/client';
import { ApiFailure } from '../http/errors';
import type { PlayerCore } from '../players/summary';
import { findSession, readSessionToken, sessionCookie } from './session';

export interface Authed {
  player: PlayerCore;
  tokenHash: string;
  /** Set-Cookie values the response must carry (a renewed session). */
  cookies: string[];
}

/** The player behind the request's session cookie, or null when there is none or it expired. */
export async function currentPlayer(db: Db, headers: Headers, now: number = Date.now()): Promise<Authed | null> {
  const token = readSessionToken(headers);
  if (!token) return null;
  const hit = await findSession(db, token, now);
  if (!hit) return null;
  return { player: hit.player, tokenHash: hit.tokenHash, cookies: hit.renewed ? [sessionCookie(token)] : [] };
}

export async function requireSession(db: Db, headers: Headers, now: number = Date.now()): Promise<Authed> {
  const authed = await currentPlayer(db, headers, now);
  if (!authed) throw new ApiFailure('unauthorized');
  return authed;
}
