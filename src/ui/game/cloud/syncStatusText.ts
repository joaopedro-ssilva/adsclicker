import type { CloudStatus } from '@/game/cloud';
import { formatAgo } from './formatAgo';

export interface SyncStatusInput {
  status: CloudStatus;
  unavailable: boolean;
  lastSyncedAt: number | null;
  now: number;
}

export interface SyncStatusView {
  text: string;
  tone: 'good' | 'neutral' | 'warn' | 'bad';
}

/** The one line the indicator shows for the cloud, in the player's words. */
export function syncStatusView({ status, unavailable, lastSyncedAt, now }: SyncStatusInput): SyncStatusView {
  switch (status) {
    case 'syncing':
      return { text: 'Sincronizando…', tone: 'neutral' };
    case 'synced':
      return {
        text: lastSyncedAt === null ? 'Salvo na nuvem' : `Salvo na nuvem ${formatAgo(now - lastSyncedAt)}`,
        tone: 'good',
      };
    case 'conflict':
      return { text: 'Conflito: escolha qual progresso manter', tone: 'warn' };
    case 'offline':
      return unavailable
        ? { text: 'Nuvem indisponível: salvando só neste aparelho', tone: 'neutral' }
        : { text: 'Sem conexão: salvando só neste aparelho', tone: 'warn' };
    default:
      return { text: 'Conectando à nuvem…', tone: 'neutral' };
  }
}
