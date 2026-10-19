/**
 * GET /api/lab/profile: the public Laboratório profile of a ranked player, opened from the lab Ranking. It reads the
 * `lab_profile` column the sync derives from the save (what they wear in the lab and their lab numbers) plus the builds
 * of the two records, and sends it back through the content, so ids the game no longer knows never reach the page. The
 * same rule as the boards: flagged, banned and test accounts and players with no nickname have none (404). A player who
 * never unlocked the lab has none either.
 */
import { and, eq } from 'drizzle-orm';
import { content } from '@/game/content';
import { readLabBuild } from '@/game/engine/lab/build';
import { readLabProfile } from '@/game/engine/lab/profile';
import { professorIdSchema } from '@/shared/api';
import type { LabProfile } from '@/shared/api';
import type { Db } from '../db/client';
import { players, rankedCondition } from '../db/schema';
import { ApiFailure } from '../http/errors';
import { nicknameKey } from '../players/nickname';
import { getTagCatalog, publicTagsOf } from '../players/tags';

type Row = Pick<
  typeof players.$inferSelect,
  'nickname' | 'titles' | 'avatarProfessor' | 'avatarSkin' | 'labProfile' | 'labBestPhase' | 'labBestPhaseBuild' | 'bestRunCoinsText' | 'bestRunBuild'
>;

/** The profile from the row. Pure, for tests. Null when the row has no lab to show. */
export function buildLabProfile(row: Row, tags: LabProfile['tags']): LabProfile | null {
  const data = readLabProfile(row.labProfile, content);
  if (!data) return null;
  const professor = professorIdSchema.safeParse(row.avatarProfessor);
  return {
    nickname: row.nickname ?? '',
    professor: professor.success ? professor.data : 'edecio',
    skin: row.avatarSkin,
    ...(tags ? { tags } : {}),
    monitor: data.monitor,
    theme: data.theme,
    decor: data.decor,
    startItem: data.startItem,
    // The column of the board is the authority on the record; the profile numbers only add to it.
    bestPhase: Math.max(0, row.labBestPhase),
    phaseBuild: readLabBuild(row.labBestPhaseBuild, content),
    bestRunCoins: row.bestRunCoinsText,
    runBuild: readLabBuild(row.bestRunBuild, content),
    stats: {
      commitsEarned: data.stats.commitsEarned,
      runs: data.stats.runs,
      broken: data.stats.broken,
      phasesCleared: data.stats.phasesCleared,
      bossesBeaten: data.stats.bossesBeaten,
      itemsFound: data.stats.itemsFound,
      itemsRecycled: data.stats.itemsRecycled,
      itemLevelUps: data.stats.itemLevelUps,
      affixRerolls: data.stats.affixRerolls,
      clicks: data.stats.clicks,
      cosmeticsOwned: data.stats.cosmeticsOwned,
    },
  };
}

async function loadLabProfile(db: Db, key: string, now: number): Promise<LabProfile> {
  const [row] = await db
    .select({
      nickname: players.nickname,
      titles: players.titles,
      avatarProfessor: players.avatarProfessor,
      avatarSkin: players.avatarSkin,
      labProfile: players.labProfile,
      labBestPhase: players.labBestPhase,
      labBestPhaseBuild: players.labBestPhaseBuild,
      bestRunCoinsText: players.bestRunCoinsText,
      bestRunBuild: players.bestRunBuild,
    })
    .from(players)
    .where(and(eq(players.nicknameKey, key), rankedCondition()))
    .limit(1);
  if (!row) throw new ApiFailure('not_found');
  const catalog = await getTagCatalog(db, now);
  const profile = buildLabProfile(row, publicTagsOf(catalog, row.titles));
  if (!profile) throw new ApiFailure('not_found');
  return profile;
}

/** Cards are read in bursts (a few clicks on the same top players): keep each for a while, and only so many. */
const TTL_MS = 30_000;
const MAX_ENTRIES = 200;
const cache = new Map<string, { at: number; value: Promise<LabProfile> }>();

export function getLabProfile(db: Db, nickname: string, now: number = Date.now()): Promise<LabProfile> {
  const key = nicknameKey(nickname);
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.value;
  const value = loadLabProfile(db, key, now);
  // A failed load (not found, database down) is not kept.
  value.catch(() => cache.delete(key));
  cache.delete(key);
  cache.set(key, { at: now, value });
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  return value;
}

/** For tests. */
export function clearLabProfileCache(): void {
  cache.clear();
}
