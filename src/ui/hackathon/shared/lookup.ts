import { hackathonContent } from '@/hackathon/content';
import type { CargoDef, EnemyDef, HeadDef, ItemBaseDef, ItemRarity, StageDef, WaveBuffDef, ActiveSkillDef } from '@/hackathon/content';

const byId = <T extends { id: string }>(list: readonly T[]): Map<string, T> => new Map(list.map((entry) => [entry.id, entry]));

export const headById: Map<string, HeadDef> = byId(hackathonContent.heads);
export const cargoById: Map<string, CargoDef> = byId(hackathonContent.cargos);
export const enemyById: Map<string, EnemyDef> = byId(hackathonContent.enemies);
export const itemBaseById: Map<string, ItemBaseDef> = byId(hackathonContent.items);
export const skillDefById: Map<string, ActiveSkillDef> = byId(hackathonContent.skills);
export const waveBuffById: Map<string, WaveBuffDef> = byId(hackathonContent.waveBuffs);
export const stageDefById: Map<string, StageDef> = byId(hackathonContent.stages);

export const RARITY_NAME: Record<ItemRarity, string> = {
  comum: 'Comum',
  incomum: 'Incomum',
  raro: 'Raro',
  epico: 'Épico',
  lendario: 'Lendário',
};

/** 0 (common) to 4 (legendary): ceremonies and effects scale with it. */
export const RARITY_RANK: Record<ItemRarity, number> = { comum: 0, incomum: 1, raro: 2, epico: 3, lendario: 4 };

/** CSS colour of a rarity, defined in arena.css as --ar-rarity-<id>. */
export const rarityColor = (rarity: ItemRarity): string => `var(--ar-rarity-${rarity})`;
