import type { CloudSave, Me, SaveSummary } from '@/shared/api';
import type { PlayerRow } from '../db/schema';

/** The columns every "who is this" answer needs; the save text is not among them. */
export type PlayerCore = Omit<PlayerRow, 'save'>;

export function isRanked(player: Pick<PlayerCore, 'nickname' | 'flagged' | 'banned' | 'testAccount'>): boolean {
  return player.nickname !== null && !player.flagged && !player.banned && !player.testAccount;
}

function unrankedReason(player: Pick<PlayerCore, 'nickname' | 'flagged' | 'banned' | 'testAccount'>): string | null {
  if (isRanked(player)) return null;
  if (player.banned) return 'Esta conta foi suspensa do ranking.';
  if (player.testAccount) return 'Conta de teste: fica fora do ranking.';
  if (player.nickname === null) return 'Escolha um apelido para aparecer no ranking.';
  return 'Seu progresso está em verificação e fica fora do ranking por enquanto.';
}

export function toMe(player: Pick<PlayerCore, 'id' | 'nickname' | 'passwordHash' | 'flagged' | 'banned' | 'testAccount'>): Me {
  return {
    id: player.id,
    nickname: player.nickname,
    hasPassword: player.passwordHash !== null,
    ranked: isRanked(player),
    unrankedReason: unrankedReason(player),
  };
}

export function toSummary(player: PlayerCore): SaveSummary {
  return {
    lifetimeCoins: player.lifetimeCoinsText,
    diplomasEarned: player.diplomasEarned,
    professors: player.professors,
    achievements: player.achievements,
    playSeconds: player.playSeconds,
  };
}

/** Revision, time and summary of the cloud save, or null for an account that never synced. */
export function toCloudInfo(player: PlayerCore): Omit<CloudSave, 'save'> | null {
  if (player.rev === 0) return null;
  return { rev: player.rev, savedAt: player.lastSeenAt.getTime(), summary: toSummary(player) };
}

/** The cloud save as the contract describes it, or null for an account that never synced. */
export function toCloudSave(player: PlayerCore & { save: string | null }): CloudSave | null {
  const info = toCloudInfo(player);
  return info && player.save !== null ? { ...info, save: player.save } : null;
}
