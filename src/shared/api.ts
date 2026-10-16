/**
 * The HTTP contract between the game (browser) and the backend (Next.js route handlers).
 * Both sides import these schemas and types, so a change here is a change on both ends.
 * See docs/BACKEND.md for behaviour, security rules and caching of each endpoint.
 */
import { z } from 'zod';
import { PROFESSOR_IDS } from '@/game/content/types';
import { TAG_COLOR_PATTERN, TAG_DESCRIPTION_MAX, TAG_LABEL_MAX, TAG_VISIBILITIES } from './tags';

// ---------------------------------------------------------------------------
// Limits shared by client and server
// ---------------------------------------------------------------------------

/** Largest serialized save the server accepts, in characters. A late-game save is about 10k. */
export const MAX_SAVE_CHARS = 64_000;
/** How often the game syncs while it is open. Doubles as the "online" heartbeat. */
export const SYNC_INTERVAL_MS = 45_000;
/** A player counts as online when their last sync is newer than this. */
export const ONLINE_WINDOW_MS = 120_000;

/** Largest clock skew the sync accepts in its `clock` report (a year); anything beyond is not a report to keep. */
export const CLOCK_SKEW_MAX_MS = 86_400_000 * 365;

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

/** A public tag as the game shows it, next to a nickname (shared/tags.ts). */
export const publicTagSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  /** `#rrggbb` */
  color: z.string(),
});
export type PublicTag = z.infer<typeof publicTagSchema>;

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
  /** The public tags this player holds, highest priority first. Absent = none. */
  tags: z.array(publicTagSchema).optional(),
});
export type Me = z.infer<typeof meSchema>;

/**
 * Permanent classroom bonuses earned in the Hackathon mode (docs/HACKATHON.md). The game applies
 * them with the store's setCloudBonus. Absent = no bonus (older servers, or no Hackathon profile).
 */
export const cloudBonusSchema = z.object({
  /** Multiplies every source of ADScoins. */
  cargo: z.number(),
  /** Multiplies the disciplines of one professor. */
  mentors: z.partialRecord(professorIdSchema, z.number()),
});
export type CloudBonusPayload = z.infer<typeof cloudBonusSchema>;

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
  /**
   * The progress epoch this device last saw (GET /api/me). Absent or 0 = the test phase. A device
   * whose epoch is not the account's gets `status: 'reset'` and nothing is written.
   */
  epoch: z.number().int().min(0).optional(),
  /**
   * What the browser saw about its own clock (game/clock/trustedClock.ts). Sent only when something is
   * off, so an honest client never carries it. A forgeable hint: the server's own check of the save
   * against its clock is the defence; this only makes it quicker and leaves a trail in the logs.
   */
  clock: z
    .object({
      /** `Date.now`, `performance.now` or `requestAnimationFrame` is no longer the browser's own function. */
      patched: z.boolean(),
      /** The page's `Date.now()` minus the browser's real one, in ms (0 when they agree). */
      skewMs: z.number().int().min(-CLOCK_SKEW_MAX_MS).max(CLOCK_SKEW_MAX_MS),
    })
    .optional(),
});
export type SyncRequest = z.infer<typeof syncRequestSchema>;

export const syncResponseSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    rev: z.number().int(),
    serverTime: z.number(),
    /** Coin multiplier the game must apply (global event x this player's own). 1 = normal. */
    multiplier: z.number(),
    bonus: cloudBonusSchema.optional(),
    me: meSchema,
  }),
  z.object({
    /** The cloud holds progress this device has not seen (another device synced). Nothing was written. */
    status: z.literal('conflict'),
    cloud: cloudSaveSchema,
    multiplier: z.number(),
    bonus: cloudBonusSchema.optional(),
    me: meSchema,
  }),
  z.object({
    /**
     * The progress was reset (docs/BACKEND.md, "Títulos e reset de lançamento") and this device
     * still holds a save from before. Nothing was written. The device must start over at `epoch`.
     */
    status: z.literal('reset'),
    epoch: z.number().int(),
    multiplier: z.number(),
    bonus: cloudBonusSchema.optional(),
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
  bonus: cloudBonusSchema.optional(),
  /** Revision and summary of the cloud save, without the save itself. */
  cloud: cloudSaveSchema.omit({ save: true }).nullable(),
  /** The progress epoch of this account (of the game, without a session). Absent on older servers. */
  epoch: z.number().int().optional(),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

/**
 * POST /api/account/nickname — claiming a nickname sets the account's password in the same step
 * (the confirmation field is checked by the client only). An account that already has a password
 * must send that same password, which proves the claim is made by its owner.
 */
export const nicknameRequestSchema = z.object({ nickname: nicknameSchema, password: passwordSchema });
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
  bonus: cloudBonusSchema.optional(),
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
  /** The best Hackathon item this player owns, to show off next to the nickname. */
  item: z.object({ base: z.string(), rarity: z.string() }).nullable().optional(),
  /** The public tags this player holds, highest priority first. Absent = none. */
  tags: z.array(publicTagSchema).optional(),
});
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;

export const leaderboardResponseSchema = z.object({
  board: boardSchema,
  entries: z.array(leaderboardEntrySchema),
  /** Epoch ms when the list was computed (it is cached for a few seconds). */
  updatedAt: z.number(),
});
export type LeaderboardResponse = z.infer<typeof leaderboardResponseSchema>;

// ---------------------------------------------------------------------------
// GET /api/lab/leaderboard?board=phase|run — the Laboratório boards
// ---------------------------------------------------------------------------

/** phase: highest lab phase ever reached. run: most ADScoins made in a single turma. Both permanent. */
export const LAB_BOARDS = ['phase', 'run'] as const;
export const labBoardSchema = z.enum(LAB_BOARDS);
export type LabBoard = z.infer<typeof labBoardSchema>;

/** One equipped item of the build a record was set with. */
export const labBuildItemSchema = z.object({
  slot: z.string(),
  base: z.string(),
  rarity: z.string(),
  level: z.number().int(),
});
export type LabBuildEntry = z.infer<typeof labBuildItemSchema>;

export const labBoardRowSchema = z.object({
  rank: z.number().int(),
  nickname: z.string(),
  /** phase: the number as text. run: ADScoins as a decimal string ("1.5e+30"). */
  value: z.string(),
  /** The items equipped when the record was set (empty = unknown). */
  build: z.array(labBuildItemSchema),
  tags: z.array(publicTagSchema).optional(),
});
export type LabBoardRow = z.infer<typeof labBoardRowSchema>;

export const labLeaderboardResponseSchema = z.object({
  board: labBoardSchema,
  entries: z.array(labBoardRowSchema),
  /** The caller's own row and place (null without a session, nickname, or a ranked record). Never cached. */
  me: labBoardRowSchema.nullable(),
  updatedAt: z.number(),
});
export type LabLeaderboardResponse = z.infer<typeof labLeaderboardResponseSchema>;

/** GET /api/players/profile?nickname=— the public card of a ranked player, opened from the ranking. */
export const playerProfileSchema = z.object({
  nickname: z.string(),
  /** What they have on screen now: professor, the skin that professor wears, the scenery. */
  professor: professorIdSchema,
  skin: z.string(),
  scenery: z.string(),
  online: z.boolean(),
  /** Epoch ms of the account creation. */
  memberSince: z.number(),
  tags: z.array(publicTagSchema).optional(),
  stats: z.object({
    /** Decimal strings. */
    lifetimeCoins: z.string(),
    coinsPerSecond: z.string(),
    clickValue: z.string(),
    graduations: z.number(),
    diplomasEarned: z.number(),
    playSeconds: z.number(),
    professorsHired: z.number(),
    maestrias: z.number(),
    clicks: z.number(),
    maxCombo: z.number(),
    bestEventStreak: z.number(),
    sprintsCompleted: z.number(),
    achievements: z.number(),
    skins: z.number(),
    sceneries: z.number(),
  }),
});
export type PlayerProfile = z.infer<typeof playerProfileSchema>;

/** GET /api/me/ranks — this player's position on each board, or null when not ranked. */
export const ranksResponseSchema = z.object({
  ranks: z.record(boardSchema, z.number().int().nullable()),
});
export type RanksResponse = z.infer<typeof ranksResponseSchema>;

// ---------------------------------------------------------------------------
// GET /api/community — totals and the activity feed
// ---------------------------------------------------------------------------

export const FEED_KINDS = ['joined', 'hire', 'allProfessors', 'graduation', 'skin', 'item', 'promotion'] as const;

export const feedItemSchema = z.object({
  id: z.string(),
  nickname: z.string(),
  kind: z.enum(FEED_KINDS),
  /** hire: professor id; skin: skin id; graduation: the graduation number as text; item: Hackathon item base id (a legendary drop); promotion: Hackathon cargo id. */
  detail: z.string().nullable(),
  at: z.number(),
  /** The public tags this player holds, highest priority first. Absent = none. */
  tags: z.array(publicTagSchema).optional(),
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
  /** Cleared for good: the anticheat never flags this player. */
  trusted: z.boolean(),
  /** True for the player of the browser making the request. */
  self: z.boolean(),
  /** Ids of every tag this player holds (public and admin-only), in catalogue order. */
  tags: z.array(z.string()),
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
  /** Cleared for good: the anticheat never flags them again. Turning it on also clears a current flag (unless `flagged` says otherwise). */
  trusted: z.boolean().optional(),
  /** Removes an offensive nickname (the player can pick another). */
  clearNickname: z.literal(true).optional(),
  /** Gives the player a tag (no-op when held). A single-holder tag cannot go to a second player. */
  grantTag: z.string().min(1).max(64).optional(),
  /** Takes a tag away (no-op when not held). */
  revokeTag: z.string().min(1).max(64).optional(),
});
export type AdminPlayerPatch = z.infer<typeof adminPlayerPatchSchema>;

export const adminPlayerResponseSchema = z.object({ player: adminPlayerSchema });
export type AdminPlayerResponse = z.infer<typeof adminPlayerResponseSchema>;

/** POST /api/admin/players/[id]/password-reset (no body). The temporary password comes back once and is never stored in clear. */
export const adminPasswordResetResponseSchema = z.object({
  player: adminPlayerSchema,
  temporaryPassword: z.string(),
});
export type AdminPasswordResetResponse = z.infer<typeof adminPasswordResetResponseSchema>;

// ---------------------------------------------------------------------------
// Admin: player tags (GET/POST /api/admin/tags, POST/DELETE /api/admin/tags/[id])
// ---------------------------------------------------------------------------

export const tagVisibilitySchema = z.enum(TAG_VISIBILITIES);

export const adminTagSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  color: z.string(),
  visibility: tagVisibilitySchema,
  /** At most one player may hold it. */
  single: z.boolean(),
  /** How many players hold it now. */
  holders: z.number().int(),
});
export type AdminTag = z.infer<typeof adminTagSchema>;

export const adminTagsResponseSchema = z.object({ tags: z.array(adminTagSchema) });
export type AdminTagsResponse = z.infer<typeof adminTagsResponseSchema>;

const tagLabelSchema = z
  .string()
  .trim()
  .min(1, 'Dê um nome à tag.')
  .max(TAG_LABEL_MAX, `O nome pode ter no máximo ${TAG_LABEL_MAX} caracteres.`);
const tagDescriptionSchema = z.string().trim().max(TAG_DESCRIPTION_MAX, `A descrição pode ter no máximo ${TAG_DESCRIPTION_MAX} caracteres.`);
const tagColorSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(TAG_COLOR_PATTERN, 'Cor inválida: use o formato #rrggbb.');

/** POST /api/admin/tags */
export const adminTagCreateSchema = z.object({
  label: tagLabelSchema,
  description: tagDescriptionSchema.default(''),
  color: tagColorSchema,
  visibility: tagVisibilitySchema,
  single: z.boolean().default(false),
});
export type AdminTagCreate = z.input<typeof adminTagCreateSchema>;

/** POST /api/admin/tags/[id] — any subset of the fields. */
export const adminTagPatchSchema = z.object({
  label: tagLabelSchema.optional(),
  description: tagDescriptionSchema.optional(),
  color: tagColorSchema.optional(),
  visibility: tagVisibilitySchema.optional(),
  single: z.boolean().optional(),
});
export type AdminTagPatch = z.infer<typeof adminTagPatchSchema>;

export const adminTagResponseSchema = z.object({ tag: adminTagSchema });
export type AdminTagResponse = z.infer<typeof adminTagResponseSchema>;

/** DELETE /api/admin/tags/[id]: the tag is gone and taken from everyone who held it. */
export const adminTagDeleteResponseSchema = z.object({ removedFrom: z.number().int() });
export type AdminTagDeleteResponse = z.infer<typeof adminTagDeleteResponseSchema>;

// ---------------------------------------------------------------------------
// Admin: everything about one player (GET /api/admin/players/[id]/stats)
// ---------------------------------------------------------------------------

export const adminStatRowSchema = z.object({
  label: z.string(),
  /** Ready to show. */
  value: z.string(),
  /** Epoch ms when the value is a moment: the page formats it in the admin's time zone (`value` is the fallback). */
  at: z.number().optional(),
});
export type AdminStatRow = z.infer<typeof adminStatRowSchema>;

export const adminPlayerStatsSchema = z.object({
  /** False when the player never synced: only the account section is there. */
  hasSave: z.boolean(),
  sections: z.array(z.object({ title: z.string(), rows: z.array(adminStatRowSchema) })),
});
export type AdminPlayerStats = z.infer<typeof adminPlayerStatsSchema>;

/** What the bulk grant of "Turma Zero" would do, to show before confirming. */
export const adminTurmaZeroPreviewSchema = z.object({
  /** Accounts with a nickname that synced at least once. */
  eligible: z.number().int(),
  /** Of those, how many already hold the title. */
  alreadyHave: z.number().int(),
  /** eligible - alreadyHave: the accounts a POST would change. */
  toGrant: z.number().int(),
});
export type AdminTurmaZeroPreview = z.infer<typeof adminTurmaZeroPreviewSchema>;

/** POST /api/admin/titles/turma-zero */
export const adminTurmaZeroResultSchema = z.object({ granted: z.number().int(), alreadyHad: z.number().int() });
export type AdminTurmaZeroResult = z.infer<typeof adminTurmaZeroResultSchema>;

// ---------------------------------------------------------------------------
// Admin: server log and class activity (GET /api/admin/logs, /api/admin/activity)
// ---------------------------------------------------------------------------

export const LOG_LEVELS = ['info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];
export const LOG_RANGES = ['1h', '24h', '7d', 'all'] as const;
export type LogRange = (typeof LOG_RANGES)[number];

/** How long the server log and the activity feed keep rows (whichever limit comes first). */
export const LOG_RETENTION_DAYS = 30;
export const LOG_RETENTION_MAX_ROWS = 100_000;

export const adminLogEntrySchema = z.object({
  id: z.number(),
  at: z.number(),
  level: z.enum(LOG_LEVELS),
  kind: z.string(),
  message: z.string(),
  playerId: z.string().nullable(),
  nickname: z.string().nullable(),
  route: z.string().nullable(),
  detail: z.unknown(),
});
export type AdminLogEntry = z.infer<typeof adminLogEntrySchema>;

export const adminTrafficHourSchema = z.object({
  hour: z.number(),
  accepted: z.number().int(),
  rejected: z.number().int(),
  players: z.number().int(),
});
export type AdminTrafficHour = z.infer<typeof adminTrafficHourSchema>;

export const adminLogsResponseSchema = z.object({
  entries: z.array(adminLogEntrySchema),
  /** Pass as `before` to load the next (older) page; null at the end. */
  nextBefore: z.number().nullable(),
  /** Kinds present in the log, for the filter. */
  kinds: z.array(z.string()),
  /** The last 24 hours, oldest first. */
  traffic: z.array(adminTrafficHourSchema),
  retentionDays: z.number(),
  maxRows: z.number(),
  serverTime: z.number(),
});
export type AdminLogsResponse = z.infer<typeof adminLogsResponseSchema>;

export const adminActivityEntrySchema = z.object({
  id: z.string(),
  at: z.number(),
  playerId: z.string(),
  nickname: z.string().nullable(),
  kind: z.string(),
  detail: z.string().nullable(),
});
export type AdminActivityEntry = z.infer<typeof adminActivityEntrySchema>;

export const adminActivityResponseSchema = z.object({
  entries: z.array(adminActivityEntrySchema),
  /** Pass as `before` to load the next (older) page; null at the end. */
  nextBefore: z.string().nullable(),
  retentionDays: z.number(),
  maxRows: z.number(),
  serverTime: z.number(),
});
export type AdminActivityResponse = z.infer<typeof adminActivityResponseSchema>;
