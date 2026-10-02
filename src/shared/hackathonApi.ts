/**
 * HTTP contract of the Hackathon mode (routes under /api/hackathon). Same rules as src/shared/api.ts:
 * both sides import these schemas, errors use `apiErrorSchema`, messages are pt-BR.
 * Behaviour is described in docs/HACKATHON.md.
 */
import { z } from 'zod';
import { RARITIES, SLOT_IDS, STAT_IDS } from '@/hackathon/content/types';
import { professorIdSchema } from './api';

// ---------------------------------------------------------------------------
// Shapes mirrored from the engine (src/hackathon/engine/types.ts)
// ---------------------------------------------------------------------------

export const cargoIdSchema = z.enum(['estudante', 'estagiario']);
export const slotIdSchema = z.enum(SLOT_IDS);
export const itemRaritySchema = z.enum(RARITIES);

const META_IDS = ['dropExtra', 'lootQuality', 'commitsGain', 'xpGain', 'setBonus', 'bossDamage', 'skillPower', 'cooldown'] as const;
const targetSchema = z.enum([...STAT_IDS, ...META_IDS]);
const modifierSchema = z.object({ target: targetSchema, op: z.enum(['add', 'pct']), value: z.number() });

export const itemInstanceSchema = z.object({
  id: z.string(),
  base: z.string(),
  rarity: itemRaritySchema,
  level: z.number().int(),
  affixes: z.array(z.object({ target: targetSchema, op: z.enum(['add', 'pct']), value: z.number(), quality: z.number() })),
  quality: z.number(),
  rerolls: z.number().int(),
  createdAt: z.number(),
});

const uniqueEffectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('modifiers'), description: z.string(), modifiers: z.array(modifierSchema) }),
  z.object({ kind: z.literal('skill'), description: z.string(), skill: z.string() }),
  z.object({ kind: z.literal('secondWind'), description: z.string() }),
  z.object({ kind: z.literal('critSplash'), description: z.string(), chance: z.number() }),
]);

export const buildSchema = z.object({
  stats: z.record(z.enum(STAT_IDS), z.number()),
  meta: z.record(z.enum(META_IDS), z.number()),
  skills: z.array(z.string()),
  uniques: z.array(uniqueEffectSchema),
  sets: z.record(z.string(), z.number()),
});

const dailyModifierSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  enemyHpPercent: z.number().optional(),
  enemyDamagePercent: z.number().optional(),
  lootQuality: z.number().optional(),
  xpPercent: z.number().optional(),
  noHealing: z.boolean().optional(),
});

export const resolvedStageSchema = z.object({
  id: z.string(),
  name: z.string(),
  level: z.number().int(),
  boss: z.boolean(),
  waves: z.array(z.array(z.string())),
  drops: z.array(z.string()),
  xp: z.number(),
  commits: z.number(),
  arena: z.string(),
  modifiers: z.array(dailyModifierSchema),
});

/** A stage lasts a few minutes at most; this bounds the action log and the request body. */
export const MAX_RUN_ACTIONS = 2_000;
export const MAX_RUN_TICKS = 6_000;

const tickSchema = z.number().int().min(0).max(MAX_RUN_TICKS);
export const runActionSchema = z.discriminatedUnion('kind', [
  z.object({ tick: tickSchema, kind: z.literal('flow') }),
  z.object({ tick: tickSchema, kind: z.literal('skill'), skill: z.string().max(40) }),
  z.object({ tick: tickSchema, kind: z.literal('choice'), option: z.union([z.literal(0), z.literal(1), z.literal(2)]) }),
]);

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export const hackathonProfileSchema = z.object({
  /** HeadDef id chosen at creation. */
  head: z.string(),
  cargo: cargoIdSchema,
  level: z.number().int(),
  xp: z.number(),
  /** XP needed for the next level, or 0 at the cargo's level cap. */
  xpToNext: z.number(),
  commits: z.number(),
  cafe: z.object({
    count: z.number().int(),
    max: z.number().int(),
    /** Epoch ms when the next Café arrives, or null when full. */
    nextAt: z.number().nullable(),
  }),
  skillNodes: z.record(z.string(), z.number().int()),
  freeSkillPoints: z.number().int(),
  activeSkills: z.array(z.string()),
  /** Every professor; `unlocked` once that professor was hired at least once in the classroom. */
  mentors: z.record(professorIdSchema, z.object({ level: z.number().int(), unlocked: z.boolean() })),
  equipped: z.record(slotIdSchema, z.string().nullable()),
  items: z.array(itemInstanceSchema),
  /** Stage id -> victories. Missing = never won. */
  stages: z.record(z.string(), z.object({ clears: z.number().int() })),
  /** Item base ids found at least once. */
  collection: z.array(z.string()),
  /** Victories since the last legendary. */
  pity: z.number().int(),
  daily: z.object({ dateKey: z.string(), clears: z.number().int() }),
  /** The build computed from everything above, for the screens. */
  build: buildSchema,
  totals: z.object({ victories: z.number().int(), defeats: z.number().int(), itemsFound: z.number().int(), legendaries: z.number().int() }),
});
export type HackathonProfile = z.infer<typeof hackathonProfileSchema>;

/** GET /api/hackathon/profile */
export const profileResponseSchema = z.object({
  /** False until the third professor was hired once (read from the cloud save). */
  unlocked: z.boolean(),
  lockReason: z.string().nullable(),
  /** null while the player has not created the student yet. */
  profile: hackathonProfileSchema.nullable(),
});
export type ProfileResponse = z.infer<typeof profileResponseSchema>;

/** Every state-changing route answers with the fresh profile. */
export const profileOnlyResponseSchema = z.object({ profile: hackathonProfileSchema });
export type ProfileOnlyResponse = z.infer<typeof profileOnlyResponseSchema>;

/** POST /api/hackathon/profile — creates the student (or changes the head later). */
export const createProfileRequestSchema = z.object({ head: z.string().min(1).max(40) });
export type CreateProfileRequest = z.infer<typeof createProfileRequestSchema>;

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

/** POST /api/hackathon/run/start */
export const runStartRequestSchema = z.object({
  /** StageDef id, or "daily". */
  stageId: z.string().min(1).max(40),
  auto: z.boolean(),
});
export type RunStartRequest = z.infer<typeof runStartRequestSchema>;

export const runStartResponseSchema = z.object({
  runId: z.string(),
  seed: z.number().int(),
  auto: z.boolean(),
  build: buildSchema,
  stage: resolvedStageSchema,
  profile: hackathonProfileSchema,
});
export type RunStartResponse = z.infer<typeof runStartResponseSchema>;

/** POST /api/hackathon/run/finish */
export const runFinishRequestSchema = z.object({
  runId: z.string().min(1).max(64),
  actions: z.array(runActionSchema).max(MAX_RUN_ACTIONS),
});
export type RunFinishRequest = z.infer<typeof runFinishRequestSchema>;

export const runRewardsSchema = z.object({
  xp: z.number(),
  commits: z.number(),
  items: z.array(itemInstanceSchema),
  /** Commits received for drops that did not fit in the inventory. */
  recycledCommits: z.number(),
  levelsGained: z.number().int(),
  promotedTo: cargoIdSchema.nullable(),
  firstClear: z.boolean(),
});
export type RunRewards = z.infer<typeof runRewardsSchema>;

export const runFinishResponseSchema = z.object({
  /** The server's own result of the fight: it is the one that counts. */
  outcome: z.object({
    won: z.boolean(),
    reason: z.enum(['cleared', 'defeated', 'timeout']),
    wavesCleared: z.number().int(),
    ticks: z.number().int(),
    hpLeft: z.number(),
  }),
  rewards: runRewardsSchema,
  profile: hackathonProfileSchema,
});
export type RunFinishResponse = z.infer<typeof runFinishResponseSchema>;

// ---------------------------------------------------------------------------
// Build management
// ---------------------------------------------------------------------------

/** POST /api/hackathon/equip — itemId null empties the slot. */
export const equipRequestSchema = z.object({ slot: slotIdSchema, itemId: z.string().max(64).nullable() });
export type EquipRequest = z.infer<typeof equipRequestSchema>;

/** POST /api/hackathon/skills */
export const skillsRequestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('buy'), node: z.string().max(40) }),
  /** Refunds every point for HackathonConfig.respecCommits. */
  z.object({ action: z.literal('respec') }),
  z.object({ action: z.literal('active'), skills: z.array(z.string().max(40)).max(4) }),
]);
export type SkillsRequest = z.infer<typeof skillsRequestSchema>;

/** POST /api/hackathon/mentors — buys the next level of one mentor. */
export const mentorRequestSchema = z.object({ professor: professorIdSchema });
export type MentorRequest = z.infer<typeof mentorRequestSchema>;

/** POST /api/hackathon/items */
export const itemsRequestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('recycle'), itemIds: z.array(z.string().max(64)).min(1).max(40) }),
  z.object({ action: z.literal('reroll'), itemId: z.string().max(64), affixIndex: z.number().int().min(1).max(5) }),
]);
export type ItemsRequest = z.infer<typeof itemsRequestSchema>;
