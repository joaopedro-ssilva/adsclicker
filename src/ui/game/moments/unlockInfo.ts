import { content } from '@/game/store';
import type { SceneryDef, SkinDef, ThemeDef } from '@/game/content/types';
import type { UnlockMoment } from './momentsStore';

const skins = new Map(content.skins.map((entry) => [entry.id, entry]));
const sceneries = new Map(content.sceneries.map((entry) => [entry.id, entry]));
const themes = new Map(content.themes.map((entry) => [entry.id, entry]));

export const RARITY_LABEL = { common: 'Comum', rare: 'Raro', epic: 'Épico', legendary: 'Lendário' } as const;

export type UnlockSubject =
  | { item: 'skin'; def: SkinDef }
  | { item: 'scenery'; def: SceneryDef }
  | { item: 'theme'; def: ThemeDef };

export function unlockSubject(moment: Pick<UnlockMoment, 'item' | 'itemId'>): UnlockSubject | undefined {
  if (moment.item === 'skin') {
    const def = skins.get(moment.itemId);
    return def ? { item: 'skin', def } : undefined;
  }
  if (moment.item === 'scenery') {
    const def = sceneries.get(moment.itemId);
    return def ? { item: 'scenery', def } : undefined;
  }
  const def = themes.get(moment.itemId);
  return def ? { item: 'theme', def } : undefined;
}

export const KIND_LABEL = { skin: 'Nova skin', scenery: 'Novo cenário', theme: 'Novo tema' } as const;

/** The second line under the name: whose skin it is, or the description. */
export function unlockCaption(subject: UnlockSubject): string {
  return subject.item === 'skin'
    ? `${content.professors[subject.def.professor].name} · ${subject.def.description}`
    : subject.def.description;
}
