import type {
  ActiveSkillDef,
  CargoDef,
  EnemyDef,
  HackathonContent,
  ItemBaseDef,
  ItemRarity,
  ItemSetDef,
  MentorDef,
  RarityDef,
  SkillNodeDef,
  WaveBuffDef,
} from '../content/types';
import { RARITIES } from '../content/types';

export interface ContentIndex {
  cargos: Map<string, CargoDef>;
  nodes: Map<string, SkillNodeDef>;
  skills: Map<string, ActiveSkillDef>;
  mentors: Map<string, MentorDef>;
  items: Map<string, ItemBaseDef>;
  sets: Map<string, ItemSetDef>;
  rarities: Map<ItemRarity, RarityDef>;
  enemies: Map<string, EnemyDef>;
  buffs: Map<string, WaveBuffDef>;
}

const cache = new WeakMap<HackathonContent, ContentIndex>();

function byKey<T>(list: readonly T[], key: (item: T) => string): Map<string, T> {
  return new Map(list.map((item) => [key(item), item]));
}

/** Lookup tables for a content object, built once per object. */
export function indexOf(content: HackathonContent): ContentIndex {
  const hit = cache.get(content);
  if (hit) return hit;
  const index: ContentIndex = {
    cargos: byKey(content.cargos, (c) => c.id),
    nodes: byKey(content.skillNodes, (n) => n.id),
    skills: byKey(content.skills, (s) => s.id),
    mentors: byKey(content.mentors, (m) => m.professor),
    items: byKey(content.items, (i) => i.id),
    sets: byKey(content.sets, (s) => s.id),
    rarities: new Map(content.rarities.map((r) => [r.id, r])),
    enemies: byKey(content.enemies, (e) => e.id),
    buffs: byKey(content.waveBuffs, (b) => b.id),
  };
  cache.set(content, index);
  return index;
}

export function rarityIndex(rarity: ItemRarity): number {
  return RARITIES.indexOf(rarity);
}
