/**
 * GET /api/players/profile: the public card of a ranked player, opened by a click on the ranking. Only
 * ranked players have one (the same rule as the boards: flagged, banned and test accounts stay hidden).
 * The progress is read from the cloud save, like the admin stats, but only what is fit to show publicly.
 */
import { and, eq } from 'drizzle-orm';
import { content } from '@/game/content';
import { PROFESSOR_IDS } from '@/game/content/types';
import { clickValue, coinsPerSecond, deserializeState, donationTitleFor } from '@/game/engine';
import { unlockedMaestrias } from '@/game/engine/maestria';
import type { GameState } from '@/game/engine/state';
import { ONLINE_WINDOW_MS, professorIdSchema } from '@/shared/api';
import type { PlayerProfile } from '@/shared/api';
import type { Db } from '../db/client';
import { players, rankedCondition } from '../db/schema';
import { ApiFailure } from '../http/errors';
import { nicknameKey } from '../players/nickname';
import { getTagCatalog, publicTagsOf } from '../players/tags';

const owned = (record: Record<string, boolean>) => Object.values(record).filter(Boolean).length;

interface ProfileRow {
  nickname: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  avatarProfessor: string;
  avatarSkin: string;
  titles: string[];
}

/** The card, from the account row and the parsed save. Pure, for tests. */
export function buildProfile(row: ProfileRow, state: GameState | null, tags: PlayerProfile['tags'], now: number): PlayerProfile {
  const avatar = professorIdSchema.safeParse(row.avatarProfessor);
  const professor = state?.activeProfessor ?? (avatar.success ? avatar.data : 'edecio');
  const skin = state?.equippedSkin[professor] ?? row.avatarSkin;
  const donorTitle = state ? donationTitleFor(state.donated) : null;
  return {
    nickname: row.nickname ?? '',
    professor,
    skin,
    scenery: state?.equippedScenery ?? '',
    online: row.lastSeenAt.getTime() > now - ONLINE_WINDOW_MS,
    memberSince: row.createdAt.getTime(),
    ...(tags ? { tags } : {}),
    ...(donorTitle ? { donorTitle: donorTitle.id } : {}),
    stats: {
      lifetimeCoins: state ? state.lifetimeCoins.toString() : '0',
      coinsPerSecond: state ? coinsPerSecond(state, content).toString() : '0',
      clickValue: state ? clickValue(state, content).toString() : '0',
      graduations: state?.counters.graduations ?? 0,
      diplomasEarned: state?.diplomasEarned ?? 0,
      playSeconds: state?.counters.playSeconds ?? 0,
      professorsHired: state ? PROFESSOR_IDS.filter((id) => state.hired[id]).length : 0,
      maestrias: state ? unlockedMaestrias(state).length : 0,
      clicks: state?.counters.clicks ?? 0,
      maxCombo: state?.counters.maxCombo ?? 0,
      bestEventStreak: state?.counters.bestEventStreak ?? 0,
      sprintsCompleted: state?.counters.sprintsCompleted ?? 0,
      achievements: state ? Object.keys(state.achievements).length : 0,
      skins: state ? owned(state.skins) : 0,
      sceneries: state ? owned(state.sceneries) : 0,
    },
  };
}

async function loadProfile(db: Db, key: string, now: number): Promise<PlayerProfile> {
  const [row] = await db
    .select({
      nickname: players.nickname,
      createdAt: players.createdAt,
      lastSeenAt: players.lastSeenAt,
      avatarProfessor: players.avatarProfessor,
      avatarSkin: players.avatarSkin,
      titles: players.titles,
      save: players.save,
    })
    .from(players)
    .where(and(eq(players.nicknameKey, key), rankedCondition()))
    .limit(1);
  if (!row) throw new ApiFailure('not_found');
  const catalog = await getTagCatalog(db, now);
  const state = row.save !== null ? deserializeState(row.save, content, now) : null;
  return buildProfile(row, state, publicTagsOf(catalog, row.titles), now);
}

/** Cards are read in bursts (a few clicks on the same top players): keep each for a while, and only so many. */
const TTL_MS = 30_000;
const MAX_ENTRIES = 200;
const cache = new Map<string, { at: number; value: Promise<PlayerProfile> }>();

export function getProfile(db: Db, nickname: string, now: number = Date.now()): Promise<PlayerProfile> {
  const key = nicknameKey(nickname);
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.value;
  const value = loadProfile(db, key, now);
  // A failed load (not found, database down) is not kept.
  value.catch(() => cache.delete(key));
  cache.delete(key);
  cache.set(key, { at: now, value });
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  return value;
}

/** For tests. */
export function clearProfileCache(): void {
  cache.clear();
}
