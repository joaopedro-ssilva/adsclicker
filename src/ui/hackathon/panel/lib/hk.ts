import { hackathonContent } from '@/hackathon/content';
import type { CargoDef, EnemyDef, ItemBaseDef, ItemSetDef, MentorDef, RarityDef, SkillNodeDef, StageDef } from '@/hackathon/content';
import type { ActiveSkillDef } from '@/hackathon/content';

export const HK = hackathonContent;

const byId = <T extends { id: string }>(list: readonly T[]): Map<string, T> => new Map(list.map((entry) => [entry.id, entry]));

export const baseById: Map<string, ItemBaseDef> = byId(HK.items);
export const setById: Map<string, ItemSetDef> = byId(HK.sets);
export const stageById: Map<string, StageDef> = byId(HK.stages);
export const nodeById: Map<string, SkillNodeDef> = byId(HK.skillNodes);
export const skillById: Map<string, ActiveSkillDef> = byId(HK.skills);
export const enemyById: Map<string, EnemyDef> = byId(HK.enemies);
export const cargoById: Map<string, CargoDef> = byId(HK.cargos);
export const rarityById: Map<string, RarityDef> = byId(HK.rarities);
export const mentorById: Map<string, MentorDef> = new Map(HK.mentors.map((mentor) => [mentor.professor, mentor]));

/** The campaign in play order. */
export const CAMPAIGN: StageDef[] = [...HK.stages].sort((a, b) => a.chapter - b.chapter || a.order - b.order);
