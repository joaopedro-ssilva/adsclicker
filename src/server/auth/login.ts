import { eq } from 'drizzle-orm';
import type { LoginRequest, LoginResponse } from '@/shared/api';
import { getEventMultiplier } from '../config/eventMultiplier';
import type { Db } from '../db/client';
import { players } from '../db/schema';
import { ApiFailure } from '../http/errors';
import { hashIp } from '../http/ip';
import { RATE_RULES, consume } from '../http/rateLimit';
import { nicknameKey } from '../players/nickname';
import { effectiveMultiplier } from '../players/multiplier';
import { toCloudSave, toMe } from '../players/summary';
import { burnVerification, verifyPassword } from './password';
import { createSession, deleteSession, hashToken, sessionCookie, clearedSessionCookie } from './session';

/**
 * POST /api/auth/login. An unknown nickname, an account without a password and a wrong password
 * all answer the same way and take the same time. Replaces this browser's session (a guest's, if
 * it had one) with the account's.
 */
export async function login(
  db: Db,
  request: LoginRequest,
  context: { ip: string; currentToken: string | null; now?: number },
): Promise<{ body: LoginResponse; cookies: string[] }> {
  const now = context.now ?? Date.now();
  const key = nicknameKey(request.nickname);
  await consume(db, RATE_RULES.login, hashIp(context.ip), now);
  await consume(db, RATE_RULES.loginNickname, key, now);

  const [player] = await db.select().from(players).where(eq(players.nicknameKey, key)).limit(1);
  if (!player || player.passwordHash === null) {
    await burnVerification(request.password);
    throw new ApiFailure('wrong_credentials');
  }
  if (!(await verifyPassword(request.password, player.passwordHash))) throw new ApiFailure('wrong_credentials');

  const token = await createSession(db, player.id, now);
  if (context.currentToken) await deleteSession(db, hashToken(context.currentToken));

  const multiplier = effectiveMultiplier(await getEventMultiplier(db, now), player.multiplier);
  return {
    body: { me: toMe(player), multiplier, cloud: toCloudSave(player) },
    cookies: [sessionCookie(token)],
  };
}

/** POST /api/auth/logout: ends this browser's session. Idempotent. */
export async function logout(db: Db, token: string | null): Promise<{ cookies: string[] }> {
  if (token) await deleteSession(db, hashToken(token));
  return { cookies: [clearedSessionCookie()] };
}
