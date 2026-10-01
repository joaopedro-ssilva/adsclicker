import { create } from 'zustand';
import type { CloudStore } from './types';

export type * from './types';

const unavailable = { ok: false, error: { code: 'unavailable', message: 'Nuvem indisponível.' } } as const;

/** Placeholder with the final interface: the cloud engineer owns and replaces this file. */
export const useCloud = create<CloudStore>(() => ({
  status: 'idle',
  me: null,
  lastSyncedAt: null,
  multiplier: 1,
  conflict: null,
  start: () => {},
  stop: () => {},
  syncNow: async () => {},
  useCloudSave: () => {},
  keepLocalSave: async () => {},
  setNickname: async () => unavailable,
  setPassword: async () => unavailable,
  login: async () => unavailable,
  logout: async () => {},
}));
