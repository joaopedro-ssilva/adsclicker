import { describe, expect, it } from 'vitest';
import { syncStatusView } from './syncStatusText';

const base = { unavailable: false, lastSyncedAt: 1_000, now: 13_000 };

describe('syncStatusView', () => {
  it('says how long ago the cloud was updated', () => {
    expect(syncStatusView({ ...base, status: 'synced' }).text).toBe('Salvo na nuvem há 12 s');
  });

  it('covers the other states', () => {
    expect(syncStatusView({ ...base, status: 'syncing' }).text).toBe('Sincronizando…');
    expect(syncStatusView({ ...base, status: 'offline' }).text).toBe('Sem conexão: salvando só neste aparelho');
    expect(syncStatusView({ ...base, status: 'offline', unavailable: true }).tone).toBe('neutral');
    expect(syncStatusView({ ...base, status: 'conflict' }).text).toMatch(/^Conflito/);
    expect(syncStatusView({ ...base, status: 'idle' }).text).toBe('Conectando à nuvem…');
  });
});
