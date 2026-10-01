import type { ApiError, CloudSave, Me } from '@/shared/api';

/**
 * What the interface knows about the cloud. The game itself never waits for any of this:
 * progress lives in the local save and the cloud follows in the background.
 */
export type CloudStatus =
  | 'idle' // not started yet
  | 'syncing'
  | 'synced'
  | 'offline' // server unreachable or not configured; the game keeps saving locally
  | 'conflict'; // the cloud has progress this device has not seen; waiting for the player

export interface CloudConflict {
  /** The save in the cloud (another device, or the account just logged into). */
  cloud: CloudSave;
  /** Why it came up, for the wording of the dialog. */
  origin: 'sync' | 'login';
}

export type ActionResult = { ok: true } | { ok: false; error: ApiError['error'] };

export interface CloudState {
  status: CloudStatus;
  /** null until the first successful sync or /api/me. */
  me: Me | null;
  /** Epoch ms of the last sync the server accepted, or null. */
  lastSyncedAt: number | null;
  /** Coin multiplier sent by the server (event x test account). 1 = normal. */
  multiplier: number;
  conflict: CloudConflict | null;
  /** Additive: true when the backend answered that it is not configured (or the route does not exist). The account UI hides its forms. */
  unavailable: boolean;
}

export interface CloudActions {
  /** Starts the background sync. Call once the game store is ready. Safe to call twice. */
  start(): void;
  stop(): void;
  /** Syncs right now (after a graduation, a hire, or when the player asks). */
  syncNow(): Promise<void>;
  /** Conflict answer: replace this device's progress with the cloud's. */
  useCloudSave(): void;
  /** Conflict answer: keep this device's progress and overwrite the cloud. */
  keepLocalSave(): Promise<void>;
  setNickname(nickname: string): Promise<ActionResult>;
  setPassword(password: string, currentPassword?: string): Promise<ActionResult>;
  login(nickname: string, password: string): Promise<ActionResult>;
  /** Ends the session. The local save stays on the device and becomes a new guest on the next sync. */
  logout(): Promise<void>;
}

export type CloudStore = CloudState & CloudActions;
