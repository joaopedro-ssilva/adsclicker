import type { CloudStatus } from '@/game/cloud';

export interface ConnectionMemory {
  /** The cloud has answered at least once this session. Before that, being offline is not news. */
  everSynced: boolean;
  lost: boolean;
}

export const FRESH_MEMORY: ConnectionMemory = { everSynced: false, lost: false };

/** At most one "connection lost" and one "connection back" toast per outage. */
export function nextConnectionToast(
  memory: ConnectionMemory,
  status: CloudStatus,
  unavailable: boolean,
): { memory: ConnectionMemory; toast: 'lost' | 'back' | null } {
  if (status === 'synced') {
    return { memory: { everSynced: true, lost: false }, toast: memory.lost ? 'back' : null };
  }
  if (status === 'offline' && !unavailable && memory.everSynced && !memory.lost) {
    return { memory: { ...memory, lost: true }, toast: 'lost' };
  }
  return { memory, toast: null };
}
