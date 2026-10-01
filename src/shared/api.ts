/**
 * The HTTP contract between the game (browser) and the backend (Next.js route handlers).
 * Both sides import these schemas and types, so a change here is a change on both ends.
 * See docs/BACKEND.md for behaviour, security rules and caching of each endpoint.
 */
import { z } from 'zod';
import { PROFESSOR_IDS } from '@/game/content/types';

// ---------------------------------------------------------------------------
// Limits shared by client and server
// ---------------------------------------------------------------------------

/** Largest serialized save the server accepts, in characters. A late-game save is about 10k. */
export const MAX_SAVE_CHARS = 64_000;
/** How often the game syncs while it is open. Doubles as the "online" heartbeat. */
export const SYNC_INTERVAL_MS = 45_000;
/** A player counts as online when their last sync is newer than this. */
export const ONLINE_WINDOW_MS = 120_000;

export const NICKNAME_MIN = 3;
export const NICKNAME_MAX = 16;
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 72;

/** Letters (with accents), digits, space, underscore, hyphen and dot; no leading/trailing or doubled spaces. */
export const nicknameSchema = z
  .string()
  .trim()
  .min(NICKNAME_MIN, `O apelido precisa de pelo menos ${NICKNAME_MIN} caracteres.`)
  .max(NICKNAME_MAX, `O apelido pode ter no máximo ${NICKNAME_MAX} caracteres.`)
  .regex(/^[\p{L}\p{N}_.-]+(?: [\p{L}\p{N}_.-]+)*$/u, 'Use só letras, números, espaço, ponto, hífen e sublinhado.');

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `A senha precisa de pelo menos ${PASSWORD_MIN} caracteres.`)
  .max(PASSWORD_MAX, `A senha pode ter no máximo ${PASSWORD_MAX} caracteres.`);

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

export const professorIdSchema = z.enum(PROFESSOR_IDS);

/** Who the browser is, as far as the server knows. */
export const meSchema = z.object({
  id: z.string(),
  /** null until the player picks one. Without a nickname the player does not appear on the boards. */
  nickname: z.string().nullable(),
  /** A password makes the account usable on another device. */
  hasPassword: z.boolean(),
  /** False while the player has no nickname, is flagged, is banned or is a test account. */
  ranked: z.boolean(),
  /** Why not ranked, ready to show, or null. */
  unrankedReason: z.string().nullable(),
});
export type Me = z.infer<typeof meSchema>;

/** A few numbers that describe a save, to let the player choose between two of them. */
export const saveSummarySchema = z.object({
  /** Decimal string, e.g. "1.5e12". */
  lifetimeCoins: z.string(),
  diplomasEarned: z.number(),
  professors: z.number(),
  achievements: z.number(),
  playSeconds: z.number(),
});
export type SaveSummary = z.infer<typeof saveSummarySchema>;

export const cloudSaveSchema = z.object({
  save: z.string(),
  rev: z.number().int(),
  /** Epoch ms of the last accepted sync. */
  savedAt: z.number(),
  summary: saveSummarySchema,
});
export type CloudSave = z.infer<typeof cloudSaveSchema>;

/** Every error response has this body, with a pt-BR message that can be shown as is. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum([
      'unavailable', // backend not configured or database down
      'invalid', // body failed validation
      'unauthorized',
      'forbidden',
      'rate_limited',
      'nickname_taken',
      'wrong_credentials',
      'not_found',
      'internal',
    ]),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
export type ApiErrorCode = ApiError['error']['code'];

// ---------------------------------------------------------------------------
// POST /api/sync — save to the cloud + heartbeat
// ---------------------------------------------------------------------------

export const syncRequestSchema = z.object({
  /** The engine's serializeState() output. */
  save: z.string().min(2).max(MAX_SAVE_CHARS),
  /** The cloud revision this device last saw (0 = never synced). */
  baseRev: z.number().int().min(0),
  /** After a conflict, the player chose to keep this device's progress: overwrite the cloud. */
  force: z.boolean().optional(),
});
export type SyncRequest = z.infer<typeof syncRequestSchema>;

export const syncResponseSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    rev: z.number().int(),
    serverTime: z.number(),
    /** Coin multiplier the game must apply (global event x this player's own). 1 = normal. */
    multiplier: z.number(),
    me: meSchema,
  }),
  z.object({
    /** The cloud holds progress this device has not seen (another device synced). Nothing was written. */
    status: z.literal('conflict'),
    cloud: cloudSaveSchema,
    multiplier: z.number(),
    me: meSchema,
  }),
]);
export type SyncResponse = z.infer<typeof syncResponseSchema>;

// ---------------------------------------------------------------------------
// GET /api/me — session bootstrap
// ---------------------------------------------------------------------------

export const meResponseSchema = z.object({
  /** null when this browser has no session yet (it gets one on its first sync). */
  me: meSchema.nullable(),
  multiplier: z.number(),
  /** Revision and summary of the cloud save, without the save itself. */
  cloud: cloudSaveSchema.omit({ save: true }).nullable(),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

/** POST /api/account/nickname */
export const nicknameRequestSchema = z.object({ nickname: nicknameSchema });
export type NicknameRequest = z.infer<typeof nicknameRequestSchema>;

/** POST /api/account/password — sets it the first time; changing it requires the current one. */
export const passwordRequestSchema = z.object({
  password: passwordSchema,
  currentPassword: z.string().max(PASSWORD_MAX).optional(),
});
export type PasswordRequest = z.infer<typeof passwordRequestSchema>;

export const accountResponseSchema = z.object({ me: meSchema });
export type AccountResponse = z.infer<typeof accountResponseSchema>;

/** POST /api/auth/login */
export const loginRequestSchema = z.object({
  nickname: z.string().trim().min(1).max(NICKNAME_MAX),
  password: z.string().min(1).max(PASSWORD_MAX),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const loginResponseSchema = z.object({
  me: meSchema,
  multiplier: z.number(),
  /** The account's save, for the device to adopt (or to ask the player when it also has progress). */
  cloud: cloudSaveSchema.nullable(),
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

/** POST /api/auth/logout */
export const okResponseSchema = z.object({ ok: z.literal(true) });
export type OkResponse = z.infer<typeof okResponseSchema>;

// ---------------------------------------------------------------------------
// GET /api/leaderboard?board=<board>
// ---------------------------------------------------------------------------

export const BOARDS = ['coins', 'diplomas', 'achievements', 'clicks'] as const;
export const boardSchema = z.enum(BOARDS);
export type Board = z.infer<typeof boardSchema>;

export const leaderboardEntrySchema = z.object({
  rank: z.number().int(),
  nickname: z.string(),
  /** The board's value: a decimal string for coins, an integer as string for the others. */
  value: z.string(),
  /** For the avatar: the professor on screen and the skin they wear. */
  professor: professorIdSchema,
  skin: z.string(),
  diplomas: z.number(),
  achievements: z.number(),
  online: z.boolean(),
});
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;

export const leaderboardResponseSchema = z.object({
  board: boardSchema,
  entries: z.array(leaderboardEntrySchema),
  /** Epoch ms when the list was computed (it is cached for a few seconds). */
  updatedAt: z.number(),
});
export type LeaderboardResponse = z.infer<typeof leaderboardResponseSchema>;

/** GET /api/me/ranks — this player's position on each board, or null when not ranked. */
export const ranksResponseSchema = z.object({
  ranks: z.record(boardSchema, z.number().int().nullable()),
});
export type RanksResponse = z.infer<typeof ranksResponseSchema>;

// ---------------------------------------------------------------------------
// GET /api/community — totals and the activity feed
// ---------------------------------------------------------------------------

export const FEED_KINDS = ['joined', 'hire', 'allProfessors', 'graduation', 'skin'] as const;

export const feedItemSchema = z.object({
  id: z.string(),
  nickname: z.string(),
  kind: z.enum(FEED_KINDS),
  /** hire: professor id; skin: skin id; graduation: the graduation number as text. */
  detail: z.string().nullable(),
  at: z.number(),
});
export type FeedItem = z.infer<typeof feedItemSchema>;

export const communityResponseSchema = z.object({
  online: z.number().int(),
  players: z.number().int(),
  /** Decimal string: every ADScoin the community has ever produced. */
  coins: z.string(),
  graduations: z.number().int(),
  /** Integers that can pass 2^53, so they travel as strings. */
  clicks: z.string(),
  achievements: z.number().int(),
  /** The global event multiplier (1 = no event). */
  eventMultiplier: z.number(),
  feed: z.array(feedItemSchema),
  updatedAt: z.number(),
});
export type CommunityResponse = z.infer<typeof communityResponseSchema>;

// ---------------------------------------------------------------------------
// Admin (requires the /admin session cookie)
// ---------------------------------------------------------------------------

export const adminPlayerSchema = z.object({
  id: z.string(),
  nickname: z.string().nullable(),
  hasPassword: z.boolean(),
  createdAt: z.number(),
  lastSeenAt: z.number(),
  online: z.boolean(),
  lifetimeCoins: z.string(),
  diplomasEarned: z.number(),
  graduations: z.number(),
  clicks: z.string(),
  achievements: z.number(),
  playSeconds: z.number(),
  /** This player's own coin multiplier (test accounts). */
  multiplier: z.number(),
  testAccount: z.boolean(),
  flagged: z.boolean(),
  flagReason: z.string().nullable(),
  banned: z.boolean(),
  /** True for the player of the browser making the request. */
  self: z.boolean(),
});
export type AdminPlayer = z.infer<typeof adminPlayerSchema>;

/** GET /api/admin/players?search=&page= */
export const adminPlayersResponseSchema = z.object({
  players: z.array(adminPlayerSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  eventMultiplier: z.number(),
});
export type AdminPlayersResponse = z.infer<typeof adminPlayersResponseSchema>;

export const multiplierSchema = z.number().min(0.1).max(1_000_000);

/** POST /api/admin/event — the global multiplier, for everyone. */
export const adminEventRequestSchema = z.object({ multiplier: multiplierSchema });
export type AdminEventRequest = z.infer<typeof adminEventRequestSchema>;

/** POST /api/admin/players/[id] — any subset of the fields. */
export const adminPlayerPatchSchema = z.object({
  /** A value other than 1 turns the player into a test account (off the boards). */
  multiplier: multiplierSchema.optional(),
  testAccount: z.boolean().optional(),
  flagged: z.boolean().optional(),
  banned: z.boolean().optional(),
  /** Removes an offensive nickname (the player can pick another). */
  clearNickname: z.literal(true).optional(),
});
export type AdminPlayerPatch = z.infer<typeof adminPlayerPatchSchema>;

export const adminPlayerResponseSchema = z.object({ player: adminPlayerSchema });
export type AdminPlayerResponse = z.infer<typeof adminPlayerResponseSchema>;
