import { sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import {
  bigint,
  boolean,
  check,
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
    /**
     * Cleared for good by the admin: the plausibility check still runs and logs, but never flags
     * this player (docs/BACKEND.md, "Jogador confiável"). The admin can still flag them by hand.
     */
    trusted: boolean('trusted').notNull().default(false),

    // Titles and launch reset ------------------------------------------------------------------
    /**
     * Ids of the tags this player holds (catalogue in `player_tags`). A column and not a join
     * table: the boards and the feed read it with the row they already read, and nothing queries
     * "who holds X" often enough to need an index.
     */
    titles: text('titles').array().notNull().default(sql`'{}'::text[]`),
    /**
     * The progress epoch this account is at (see server/config/progressEpoch.ts). A sync from a
     * device that holds another epoch is refused, which keeps a pre-reset save off the boards.
     */
    progressEpoch: integer('progress_epoch').notNull().default(0),
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

/**
 * Tags the admin creates and gives to players (docs/BACKEND.md, "Tags"). Players hold the ids in
 * `players.titles`; deleting a tag takes it from them in the same transaction.
 */
export const playerTags = pgTable(
  'player_tags',
  {
    id: text('id').primaryKey(),
    label: text('label').notNull(),
    description: text('description').notNull().default(''),
    /** `#rrggbb` */
    color: text('color').notNull(),
    /** public: badge on the boards, the feed and the player's own line. admin: only on /admin. */
    visibility: text('visibility').notNull().default('public'),
    /** At most one player may hold it. */
    single: boolean('single').notNull().default(false),
    /** Priority, lowest first: the badge shown when only one fits. */
    position: integer('position').notNull().default(0),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [check('player_tags_visibility', sql`${t.visibility} in ('public', 'admin')`)],
);

export type PlayerTagRow = typeof playerTags.$inferSelect;

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

// ---------------------------------------------------------------------------
// Hackathon mode (docs/HACKATHON.md). Everything is keyed by player_id and goes away with the player.
// ---------------------------------------------------------------------------

/** The student. One row per player; every mutation locks it (`select ... for update`) to serialise a player's writes. */
export const hackathonProfiles = pgTable(
  'hackathon_profiles',
  {
    playerId: uuid('player_id')
      .primaryKey()
      .references(() => players.id, { onDelete: 'cascade' }),
    head: text('head').notNull(),
    cargo: text('cargo').notNull().default('estudante'),
    level: integer('level').notNull().default(1),
    xp: bigint('xp', { mode: 'number' }).notNull().default(0),
    commits: bigint('commits', { mode: 'number' }).notNull().default(0),

    /** Café held as of `cafeAt`; the real count is computed lazily from these two (see hackathon/cafe.ts). */
    cafeCount: integer('cafe_count').notNull().default(0),
    cafeAt: timestamptz('cafe_at').notNull().defaultNow(),

    /** Skill node id -> level. */
    skillNodes: jsonb('skill_nodes').$type<Record<string, number>>().notNull().default({}),
    activeSkills: jsonb('active_skills').$type<string[]>().notNull().default([]),
    /** Professor id -> mentor level. */
    mentors: jsonb('mentors').$type<Record<string, number>>().notNull().default({}),
    /** Slot id -> item id. */
    equipped: jsonb('equipped').$type<Record<string, string>>().notNull().default({}),

    /** Victories since the last legendary item. */
    pity: integer('pity').notNull().default(0),
    victories: integer('victories').notNull().default(0),
    defeats: integer('defeats').notNull().default(0),
    itemsFound: integer('items_found').notNull().default(0),
    legendaries: integer('legendaries').notNull().default(0),

    /** Classroom counters already paid out (see hackathon/classroom.ts). */
    cafesBoughtCredited: integer('cafes_bought_credited').notNull().default(0),
    graduationsCredited: integer('graduations_credited').notNull().default(0),
    /** Day (America/Sao_Paulo) the two per-day counters below belong to. */
    creditDay: text('credit_day').notNull().default(''),
    cafesCreditedToday: integer('cafes_credited_today').notNull().default(0),
    graduationsCreditedToday: integer('graduations_credited_today').notNull().default(0),

    /** Victories in the daily stage on `dailyDay`. */
    dailyDay: text('daily_day').notNull().default(''),
    dailyClears: integer('daily_clears').notNull().default(0),

    /** The best item owned, kept up to date when items change so the boards need no computation. */
    bestItemBase: text('best_item_base'),
    bestItemRarity: text('best_item_rarity'),

    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    // Balances can never go negative, whatever a code path does.
    check('hackathon_profiles_commits_nonneg', sql`${t.commits} >= 0`),
    check('hackathon_profiles_xp_nonneg', sql`${t.xp} >= 0`),
    check('hackathon_profiles_cafe_nonneg', sql`${t.cafeCount} >= 0`),
  ],
);

export const hackathonItems = pgTable(
  'hackathon_items',
  {
    id: uuid('id').primaryKey(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    base: text('base').notNull(),
    rarity: text('rarity').notNull(),
    level: integer('level').notNull(),
    affixes: jsonb('affixes').$type<unknown[]>().notNull(),
    quality: doublePrecision('quality').notNull(),
    rerolls: integer('rerolls').notNull().default(0),
    /** Epoch ms, as stamped by the engine. */
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  },
  (t) => [index('hackathon_items_player_idx').on(t.playerId)],
);

/** One attempt at a stage. `build` and `stage` are the snapshots the server re-simulates with. */
export const hackathonRuns = pgTable(
  'hackathon_runs',
  {
    id: uuid('id').primaryKey(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    stageId: text('stage_id').notNull(),
    seed: bigint('seed', { mode: 'number' }).notNull(),
    auto: boolean('auto').notNull(),
    build: jsonb('build').notNull(),
    stage: jsonb('stage').notNull(),
    /** open | finished | abandoned | expired */
    status: text('status').notNull().default('open'),
    startedAt: timestamptz('started_at').notNull(),
    finishedAt: timestamptz('finished_at'),
  },
  (t) => [
    // A player has at most one open run: the one-way door that makes a replayed finish pay once.
    uniqueIndex('hackathon_runs_open_uq')
      .on(t.playerId)
      .where(sql`${t.status} = 'open'`),
    index('hackathon_runs_player_idx').on(t.playerId, t.startedAt.desc()),
  ],
);

export const hackathonStages = pgTable(
  'hackathon_stages',
  {
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    stageId: text('stage_id').notNull(),
    clears: integer('clears').notNull().default(0),
    firstClearAt: timestamptz('first_clear_at'),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.stageId] })],
);

export const hackathonCollection = pgTable(
  'hackathon_collection',
  {
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    base: text('base').notNull(),
    foundAt: timestamptz('found_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.base] })],
);

// ---------------------------------------------------------------------------
// Server event log (docs/BACKEND.md, "Logs"). No foreign key to players: an entry outlives the account.
// ---------------------------------------------------------------------------

/** One row per notable server event (errors, rejected saves, account and admin actions). Never one per accepted sync. */
export const serverLogs = pgTable(
  'server_logs',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    at: timestamptz('at').notNull().defaultNow(),
    /** info | warn | error */
    level: text('level').notNull(),
    /** Short machine code, e.g. server_error, login_failed, admin_ban. */
    kind: text('kind').notNull(),
    message: text('message').notNull(),
    playerId: uuid('player_id'),
    nickname: text('nickname'),
    route: text('route'),
    detail: jsonb('detail'),
  },
  (t) => [
    index('server_logs_at_idx').on(t.at.desc()),
    index('server_logs_level_at_idx').on(t.level, t.at.desc()),
    index('server_logs_kind_at_idx').on(t.kind, t.at.desc()),
  ],
);

/** Traffic counters, one row per hour (UTC), so the admin can see activity without a row per sync. */
export const trafficHourly = pgTable('traffic_hourly', {
  hour: timestamptz('hour').primaryKey(),
  syncsAccepted: integer('syncs_accepted').notNull().default(0),
  syncsRejected: integer('syncs_rejected').notNull().default(0),
});

/** Who synced in which hour: gives the distinct-player count. One row per player per hour. */
export const trafficHourlyPlayers = pgTable(
  'traffic_hourly_players',
  {
    hour: timestamptz('hour').notNull(),
    playerId: uuid('player_id').notNull(),
  },
  (t) => [primaryKey({ columns: [t.hour, t.playerId] })],
);
