import { eq } from 'drizzle-orm';
import type { AccountResponse, NicknameRequest, PasswordRequest } from '@/shared/api';
import type { Authed } from '../auth/context';
import { hashPassword, verifyPassword } from '../auth/password';
import { deleteOtherSessions } from '../auth/session';
import type { Db } from '../db/client';
import { isUniqueViolation } from '../db/client';
import { feedEvents, players } from '../db/schema';
import { ApiFailure } from '../http/errors';
import { RATE_RULES, consume } from '../http/rateLimit';
import { NICKNAME_REFUSED_MESSAGE, checkNickname, nicknameKey } from './nickname';
import { toMe } from './summary';

/** POST /api/account/nickname: picking one puts the player on the boards and announces them in the feed. */
export async function setNickname(db: Db, authed: Authed, request: NicknameRequest, now: number = Date.now()): Promise<AccountResponse> {
  const { player } = authed;
  await consume(db, RATE_RULES.nickname, player.id, now);

  if (!checkNickname(request.nickname).ok) throw new ApiFailure('invalid', NICKNAME_REFUSED_MESSAGE);
  const key = nicknameKey(request.nickname);

  try {
    await db.transaction(async (tx) => {
      await tx.update(players).set({ nickname: request.nickname, nicknameKey: key }).where(eq(players.id, player.id));
      if (player.nickname === null) {
        await tx.insert(feedEvents).values({ playerId: player.id, kind: 'joined', detail: '', createdAt: new Date(now) }).onConflictDoNothing();
      }
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new ApiFailure('nickname_taken');
    throw error;
  }
  return { me: toMe({ ...player, nickname: request.nickname }) };
}

/** POST /api/account/password: sets it the first time; changing it needs the current one and signs out other devices. */
export async function setPassword(db: Db, authed: Authed, request: PasswordRequest, now: number = Date.now()): Promise<AccountResponse> {
  const { player } = authed;
  await consume(db, RATE_RULES.password, player.id, now);

  if (player.passwordHash !== null) {
    if (!request.currentPassword) throw new ApiFailure('invalid', 'Informe a senha atual para trocá-la.');
    if (!(await verifyPassword(request.currentPassword, player.passwordHash))) {
      throw new ApiFailure('wrong_credentials', 'A senha atual está incorreta.');
    }
  }

  const passwordHash = await hashPassword(request.password);
  await db.update(players).set({ passwordHash }).where(eq(players.id, player.id));
  await deleteOtherSessions(db, player.id, authed.tokenHash);
  return { me: toMe({ ...player, passwordHash }) };
}
