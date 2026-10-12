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
import { logEvent } from '../logs/log';
import { NICKNAME_REFUSED_MESSAGE, checkNickname, nicknameKey } from './nickname';
import { toMe } from './summary';
import { getTagCatalog } from './tags';

/**
 * POST /api/account/nickname: picking one puts the player on the boards and announces them in the
 * feed. The password travels with it and is stored in the same transaction, so a nickname never
 * exists without one. An account that already has a password (its nickname was removed by the
 * admin, say) must send that password instead; it is kept as is.
 */
export async function setNickname(db: Db, authed: Authed, request: NicknameRequest, now: number = Date.now()): Promise<AccountResponse> {
  const { player } = authed;
  await consume(db, RATE_RULES.nickname, player.id, now);

  if (!checkNickname(request.nickname).ok) throw new ApiFailure('invalid', NICKNAME_REFUSED_MESSAGE);
  const key = nicknameKey(request.nickname);

  let passwordHash = player.passwordHash;
  const settingPassword = passwordHash === null;
  if (passwordHash === null) {
    passwordHash = await hashPassword(request.password);
  } else if (!(await verifyPassword(request.password, passwordHash))) {
    throw new ApiFailure('wrong_credentials', 'A senha informada não confere com a senha desta conta.');
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(players)
        .set({ nickname: request.nickname, nicknameKey: key, ...(settingPassword ? { passwordHash } : {}) })
        .where(eq(players.id, player.id));
      if (player.nickname === null) {
        await tx.insert(feedEvents).values({ playerId: player.id, kind: 'joined', detail: '', createdAt: new Date(now) }).onConflictDoNothing();
      }
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new ApiFailure('nickname_taken');
    throw error;
  }
  if (settingPassword) await deleteOtherSessions(db, player.id, authed.tokenHash);
  logEvent(db, {
    level: 'info',
    kind: 'nickname_claimed',
    message: `Apelido escolhido: ${request.nickname}`,
    playerId: player.id,
    nickname: request.nickname,
    route: '/api/account/nickname',
    detail: { first: player.nickname === null, passwordSet: settingPassword },
  });
  return { me: toMe({ ...player, nickname: request.nickname, passwordHash }, await getTagCatalog(db)) };
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
  logEvent(db, {
    level: 'info',
    kind: 'password_set',
    message: player.passwordHash === null ? 'Senha definida.' : 'Senha trocada.',
    playerId: player.id,
    nickname: player.nickname,
    route: '/api/account/password',
  });
  return { me: toMe({ ...player, passwordHash }, await getTagCatalog(db)) };
}
