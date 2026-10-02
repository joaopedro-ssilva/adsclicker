import { sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { flaggedAreRanked } from '../players/ranking';

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

interface RankedColumns {
  nickname: AnyPgColumn;
  flagged: AnyPgColumn;
  banned: AnyPgColumn;
  testAccount: AnyPgColumn;
}

/**
 * "On the boards": has a nickname and is not flagged, banned or a test account. The partial
 * indexes below and every board query use this same text, so the planner can match them.
 */
const rankedWhere = (t: RankedColumns) =>
  sql`${t.nickname} is not null and not ${t.flagged} and not ${t.banned} and not ${t.testAccount}`;

/**
 * A player is a guest until they pick a nickname. The save and the columns projected from it
 * (everything under "Projection") are written together by the sync, in one statement.
 */
export const players = pgTable(
  'players',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    /** Display form, as typed. Null until the player picks one. */
    nickname: text('nickname'),
    /** Lower case, accents removed: the uniqueness key (see players/nickname.ts). */
    nicknameKey: text('nickname_key'),
    /** scrypt hash with salt (see auth/password.ts). Null while the account has no password. */
    passwordHash: text('password_hash'),

    /** The engine's serialized save, normalised by the server. Null until the first sync stores it. */
    save: text('save'),
    /** Bumped by every accepted sync; devices compare it to detect another device's progress. */
    rev: integer('rev').notNull().default(0),

    createdAt: timestamptz('created_at').notNull().defaultNow(),
    /** Last accepted sync: the "online" heartbeat. */
    lastSeenAt: timestamptz('last_seen_at').notNull().defaultNow(),

    // Projection ---------------------------------------------------------------------------
    /** Lifetime ADScoins, exact text from the engine ("1.5e+300"). What the boards show. */
    lifetimeCoinsText: text('lifetime_coins_text').notNull().default('0'),
    /** Same value as numeric, to SUM for the community total. */
    lifetimeCoins: numeric('lifetime_coins').notNull().default('0'),
    /** log10 of the coins (0 below 1), to ORDER BY with a plain index. */
    lifetimeCoinsLog: doublePrecision('lifetime_coins_log').notNull().default(0),
    diplomasEarned: integer('diplomas_earned').notNull().default(0),
    graduations: integer('graduations').notNull().default(0),
    clicks: bigint('clicks', { mode: 'number' }).notNull().default(0),
    achievements: integer('achievements').notNull().default(0),
    professors: integer('professors').notNull().default(1),
    playSeconds: bigint('play_seconds', { mode: 'number' }).notNull().default(0),
    /** Avatar: the professor on stage and the skin they wear. */
    avatarProfessor: text('avatar_professor').notNull().default('edecio'),
    avatarSkin: text('avatar_skin').notNull().default(''),

    // Moderation ---------------------------------------------------------------------------
    /** This player's own coin multiplier (admin). */
    multiplier: doublePrecision('multiplier').notNull().default(1),
    testAccount: boolean('test_account').notNull().default(false),
    flagged: boolean('flagged').notNull().default(false),
    flagReason: text('flag_reason'),
    banned: boolean('banned').notNull().default(false),
  },
  (t) => {
    // The boards only list ranked players, so each ordering is a partial index over exactly them.
    const ranked = rankedWhere(t);
    return [
      uniqueIndex('players_nickname_key_uq').on(t.nicknameKey),
      index('players_last_seen_idx').on(t.lastSeenAt.desc()),
      index('players_board_coins_idx').on(t.lifetimeCoinsLog.desc(), t.id).where(ranked),
      index('players_board_diplomas_idx').on(t.diplomasEarned.desc(), t.id).where(ranked),
      index('players_board_achievements_idx').on(t.achievements.desc(), t.id).where(ranked),
      index('players_board_clicks_idx').on(t.clicks.desc(), t.id).where(ranked),
    ];
  },
);

/** The condition of "ranked player" for queries on `players`. */
/**
 * Who is on the boards right now. In the test phase flagged players are included (see
 * players/ranking.ts); that text no longer matches the partial indexes, so the boards sort
 * without them, which is fine at test scale.
 */
export const rankedCondition = () =>
  flaggedAreRanked()
    ? sql`${players.nickname} is not null and not ${players.banned} and not ${players.testAccount}`
    : rankedWhere(players);

/** Only the SHA-256 of the cookie token is stored, so a database leak cannot be replayed. */
export const sessions = pgTable(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    expiresAt: timestamptz('expires_at').notNull(),
  },
  (t) => [index('sessions_player_idx').on(t.playerId), index('sessions_expires_idx').on(t.expiresAt)],
);

/** Activity feed. The unique key makes every event happen once per player, whatever the replays. */
export const feedEvents = pgTable(
  'feed_events',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    /** '' when the kind has no detail (the API shows null). */
    detail: text('detail').notNull().default(''),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('feed_events_once_uq').on(t.playerId, t.kind, t.detail),
    index('feed_events_created_idx').on(t.createdAt.desc()),
  ],
);

/** Small key/value settings, e.g. the global event multiplier. */
export const appConfig = pgTable('app_config', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

/** Fixed-window counters: one row per (key, window). Old windows are swept now and then. */
export const rateLimits = pgTable(
  'rate_limits',
  {
    key: text('key').notNull(),
    windowStart: timestamptz('window_start').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] }), index('rate_limits_window_idx').on(t.windowStart)],
);

export type PlayerRow = typeof players.$inferSelect;
