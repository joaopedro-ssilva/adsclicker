import type { SkinDef } from '@/game/content/types';
import type { CargoId } from '@/hackathon/content';
import { cargoById, headById } from '../shared/lookup';

/** Colours of the procedural fallback outfit (only used while the art is missing). */
const PALETTE: SkinDef['palette'] = { primary: '#1f8f94', secondary: '#24408a', accent: '#f7ca75' };

export interface StudentSprite {
  body: string;
  head: string;
  palette: SkinDef['palette'];
  seed: string;
}

/** Props for <Character>: the cargo gives the body, the chosen head sits on its neck. */
export function studentSprite(headId: string, cargo: CargoId, seed: string): StudentSprite {
  const body = cargoById.get(cargo)?.body ?? 'hackathon/bodies/estudante';
  const head = headById.get(headId)?.asset ?? `hackathon/heads/${headId}`;
  return { body, head, palette: PALETTE, seed };
}
