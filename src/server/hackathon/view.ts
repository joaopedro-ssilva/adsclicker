import { PROFESSOR_IDS } from '@/game/content/types';
import type { ProfessorId } from '@/game/content/types';
import type { GameState } from '@/game/engine/state';
import { SLOT_IDS } from '@/hackathon/content/types';
import type { CargoId, SlotId } from '@/hackathon/content/types';
import type { BuildInput, ItemInstance } from '@/hackathon/engine/types';
import type { HackathonProfile } from '@/shared/hackathonApi';
import type { Executor, ProfileRow } from './store';
import { loadCollection, loadItems, loadSave, loadStageClears, readProfileRow } from './store';
import { cafeNextAt, regenCafe } from './cafe';
import { dateKeyOf } from './dates';
import type { HackathonDeps } from './deps';
import { unlockedMentors } from './unlock';

/** Everything the profile response is made of, read from the database. */
export interface ProfileData {
  row: ProfileRow;
  items: ItemInstance[];
  /** Stage id -> victories. */
  clears: Record<string, number>;
  collection: string[];
  /** The cloud save, for the mentors' `unlocked`. Null when the player never synced. */
  save: GameState | null;
}

export async function loadProfileData(ex: Executor, playerId: string, now: number): Promise<ProfileData | null> {
  const row = await readProfileRow(ex, playerId);
  if (!row) return null;
  return loadProfileDataFor(ex, row, now);
}

/** Same, for a row the caller already holds (locked inside a transaction). */
export async function loadProfileDataFor(ex: Executor, row: ProfileRow, now: number): Promise<ProfileData> {
  const [items, clears, collection, save] = await Promise.all([
    loadItems(ex, row.playerId),
    loadStageClears(ex, row.playerId),
    loadCollection(ex, row.playerId),
    loadSave(ex, row.playerId, now),
  ]);
  return { row, items, clears, collection, save };
}

export function asCargo(value: string, deps: HackathonDeps): CargoId {
  return deps.content.cargos.find((cargo) => cargo.id === value)?.id ?? 'estudante';
}

/** Mentor levels stored for the professors the game knows. */
export function mentorLevels(row: Pick<ProfileRow, 'mentors'>): Partial<Record<ProfessorId, number>> {
  const levels: Partial<Record<ProfessorId, number>> = {};
  for (const id of PROFESSOR_IDS) {
    const level = row.mentors[id];
    if (typeof level === 'number' && level > 0) levels[id] = level;
  }
  return levels;
}

/** The equipped items, only those that still exist and fit their slot. */
export function equippedItems(
  row: Pick<ProfileRow, 'equipped'>,
  items: ItemInstance[],
  deps: HackathonDeps,
): Partial<Record<SlotId, ItemInstance>> {
  const result: Partial<Record<SlotId, ItemInstance>> = {};
  for (const slot of SLOT_IDS) {
    const id = row.equipped[slot];
    const item = id ? items.find((candidate) => candidate.id === id) : undefined;
    const base = item ? deps.content.items.find((def) => def.id === item.base) : undefined;
    if (item && base?.slot === slot) result[slot] = item;
  }
  return result;
}

/** What the engine reads from the database to compute a build (the client never sends it). */
export function buildInputOf(
  row: Pick<ProfileRow, 'cargo' | 'level' | 'skillNodes' | 'mentors' | 'equipped' | 'activeSkills'>,
  items: ItemInstance[],
  deps: HackathonDeps,
): BuildInput {
  return {
    cargo: asCargo(row.cargo, deps),
    level: row.level,
    skillNodes: row.skillNodes,
    mentors: mentorLevels(row),
    equipped: equippedItems(row, items, deps),
    activeSkills: row.activeSkills,
  };
}

/** The one place a profile is turned into its response shape (also used right after every write). */
export function toProfile(data: ProfileData, deps: HackathonDeps, now: number): HackathonProfile {
  const { row, items } = data;
  const { engine, content } = deps;
  const cargo = asCargo(row.cargo, deps);
  const cargoDef = content.cargos.find((candidate) => candidate.id === cargo);

  const cafe = regenCafe({ count: row.cafeCount, at: row.cafeAt.getTime() }, now, content.config.cafe);
  const unlocked = unlockedMentors(data.save);
  const levels = mentorLevels(row);
  const mentors = {} as HackathonProfile['mentors'];
  for (const id of PROFESSOR_IDS) mentors[id] = { level: levels[id] ?? 0, unlocked: unlocked[id] };

  const equipped = equippedItems(row, items, deps);
  const equippedIds = {} as HackathonProfile['equipped'];
  for (const slot of SLOT_IDS) equippedIds[slot] = equipped[slot]?.id ?? null;

  const dateKey = dateKeyOf(now);
  const atCap = cargoDef ? row.level >= cargoDef.maxLevel : false;

  return {
    head: row.head,
    cargo,
    level: row.level,
    xp: row.xp,
    xpToNext: atCap ? 0 : engine.xpToNext(row.level, content),
    commits: row.commits,
    cafe: { count: cafe.count, max: content.config.cafe.max, nextAt: cafeNextAt(cafe, content.config.cafe) },
    skillNodes: row.skillNodes,
    freeSkillPoints: engine.freeSkillPoints(row.level, row.skillNodes, content),
    activeSkills: row.activeSkills,
    mentors,
    equipped: equippedIds,
    items,
    stages: Object.fromEntries(Object.entries(data.clears).map(([id, clears]) => [id, { clears }])),
    collection: data.collection,
    pity: row.pity,
    daily: { dateKey, clears: row.dailyDay === dateKey ? row.dailyClears : 0 },
    build: engine.computeBuild(buildInputOf(row, items, deps), content),
    totals: { victories: row.victories, defeats: row.defeats, itemsFound: row.itemsFound, legendaries: row.legendaries },
  };
}
