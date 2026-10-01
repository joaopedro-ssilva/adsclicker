import { content } from '@/game/content';
import type { ProfessorId, SkinDef } from '@/game/content/types';

const skinsById = new Map(content.skins.map((skin) => [skin.id, skin]));
const defaultSkinByProfessor = new Map(
  content.skins.filter((skin) => skin.default).map((skin) => [skin.professor, skin]),
);

export interface CharacterSprite {
  body: string;
  head: string;
  hat?: string;
  palette: SkinDef['palette'];
  seed: string;
}

export function skinById(id: string): SkinDef | undefined {
  return skinsById.get(id);
}

export function defaultSkinOf(professor: ProfessorId): SkinDef {
  const skin = defaultSkinByProfessor.get(professor);
  if (!skin) throw new Error(`No default skin for professor "${professor}"`);
  return skin;
}

/** Props for <Character> that draw a professor wearing a skin (falls back to the default skin). */
export function characterSprite(professor: ProfessorId, skinId?: string): CharacterSprite {
  const skin = (skinId ? skinsById.get(skinId) : undefined) ?? defaultSkinOf(professor);
  return {
    body: skin.body,
    head: `heads/${professor}`,
    hat: skin.hat,
    palette: skin.palette,
    // The seed follows the professor so the procedural head stays the same across skins.
    seed: professor,
  };
}
