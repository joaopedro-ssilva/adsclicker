/**
 * Typed calls to the backend, for the browser. Nothing here throws: every call resolves to
 * { ok: true, data } or { ok: false, error }, so the game keeps running when the network or
 * the server is down (the game is playable offline; the cloud is a bonus).
 */
import type { z } from 'zod';
import {
  accountResponseSchema,
  adminActivityResponseSchema,
  adminLogsResponseSchema,
  adminPasswordResetResponseSchema,
  adminPlayerResponseSchema,
  adminLaunchResetPreviewSchema,
  adminLaunchResetResultSchema,
  adminPlayersResponseSchema,
  adminPlayerStatsSchema,
  adminTagDeleteResponseSchema,
  adminTagResponseSchema,
  adminTagsResponseSchema,
  adminTurmaZeroPreviewSchema,
  adminTurmaZeroResultSchema,
  apiErrorSchema,
  communityResponseSchema,
  leaderboardResponseSchema,
  loginResponseSchema,
  playerProfileSchema,
  meResponseSchema,
  okResponseSchema,
  ranksResponseSchema,
  syncResponseSchema,
} from './api';
import type {
  AdminEventRequest,
  AdminPlayerPatch,
  AdminTagCreate,
  AdminTagPatch,
  ApiError,
  Board,
  LoginRequest,
  NicknameRequest,
  PasswordRequest,
  SyncRequest,
} from './api';

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError['error']; status: number };

const OFFLINE: ApiError['error'] = { code: 'unavailable', message: 'Sem conexão com o servidor.' };
const BAD_REPLY: ApiError['error'] = { code: 'internal', message: 'O servidor respondeu algo inesperado.' };

interface CallOptions {
  body?: unknown;
  /** Lets the request finish after the page is closed (the last sync before leaving). */
  keepalive?: boolean;
  signal?: AbortSignal;
}

export async function call<S extends z.ZodType>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  schema: S,
  options: CallOptions = {},
): Promise<ApiResult<z.infer<S>>> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: options.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: 'same-origin',
      keepalive: options.keepalive,
      signal: options.signal,
    });
  } catch {
    return { ok: false, error: OFFLINE, status: 0 };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, error: response.ok ? BAD_REPLY : OFFLINE, status: response.status };
  }

  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(payload);
    return { ok: false, error: parsed.success ? parsed.data.error : BAD_REPLY, status: response.status };
  }
  const parsed = schema.safeParse(payload);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: BAD_REPLY, status: response.status };
}

export const api = {
  sync: (body: SyncRequest, options: { keepalive?: boolean } = {}) =>
    call('POST', '/api/sync', syncResponseSchema, { body, keepalive: options.keepalive }),
  me: () => call('GET', '/api/me', meResponseSchema),
  ranks: () => call('GET', '/api/me/ranks', ranksResponseSchema),
  setNickname: (body: NicknameRequest) => call('POST', '/api/account/nickname', accountResponseSchema, { body }),
  setPassword: (body: PasswordRequest) => call('POST', '/api/account/password', accountResponseSchema, { body }),
  login: (body: LoginRequest) => call('POST', '/api/auth/login', loginResponseSchema, { body }),
  logout: () => call('POST', '/api/auth/logout', okResponseSchema, { body: {} }),
  leaderboard: (board: Board, signal?: AbortSignal) =>
    call('GET', `/api/leaderboard?board=${board}`, leaderboardResponseSchema, { signal }),
  community: (signal?: AbortSignal) => call('GET', '/api/community', communityResponseSchema, { signal }),
  profile: (nickname: string, signal?: AbortSignal) =>
    call('GET', `/api/players/profile?nickname=${encodeURIComponent(nickname)}`, playerProfileSchema, { signal }),

  admin: {
    players: (search: string, page: number) =>
      call('GET', `/api/admin/players?search=${encodeURIComponent(search)}&page=${page}`, adminPlayersResponseSchema),
    setEvent: (body: AdminEventRequest) => call('POST', '/api/admin/event', okResponseSchema, { body }),
    patchPlayer: (id: string, body: AdminPlayerPatch) =>
      call('POST', `/api/admin/players/${encodeURIComponent(id)}`, adminPlayerResponseSchema, { body }),
    resetPassword: (id: string) =>
      call('POST', `/api/admin/players/${encodeURIComponent(id)}/password-reset`, adminPasswordResetResponseSchema, { body: {} }),
    playerStats: (id: string) => call('GET', `/api/admin/players/${encodeURIComponent(id)}/stats`, adminPlayerStatsSchema),
    tags: () => call('GET', '/api/admin/tags', adminTagsResponseSchema),
    createTag: (body: AdminTagCreate) => call('POST', '/api/admin/tags', adminTagResponseSchema, { body }),
    updateTag: (id: string, body: AdminTagPatch) =>
      call('POST', `/api/admin/tags/${encodeURIComponent(id)}`, adminTagResponseSchema, { body }),
    deleteTag: (id: string) => call('DELETE', `/api/admin/tags/${encodeURIComponent(id)}`, adminTagDeleteResponseSchema),
    turmaZeroPreview: () => call('GET', '/api/admin/titles/turma-zero', adminTurmaZeroPreviewSchema),
    grantTurmaZero: () => call('POST', '/api/admin/titles/turma-zero', adminTurmaZeroResultSchema, { body: {} }),
    logs: (query: Record<string, string>, signal?: AbortSignal) =>
      call('GET', `/api/admin/logs?${new URLSearchParams(query).toString()}`, adminLogsResponseSchema, { signal }),
    activity: (query: Record<string, string>, signal?: AbortSignal) =>
      call('GET', `/api/admin/activity?${new URLSearchParams(query).toString()}`, adminActivityResponseSchema, { signal }),
    launchResetPreview: () => call('GET', '/api/admin/launch-reset', adminLaunchResetPreviewSchema),
    launchReset: (phrase: string) =>
      call('POST', '/api/admin/launch-reset', adminLaunchResetResultSchema, { body: { phrase } }),
  },
};
