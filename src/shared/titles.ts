/**
 * Player titles: a small fixed catalogue, in code, shared by the server (validates what the
 * admin grants) and the interface (label, tooltip and colour). The database stores only the ids.
 *
 * The catalogue is ordered by priority: the first one a player holds is the badge shown when
 * space is tight; the others go in the title attribute.
 */

/** Colour tokens the interface maps to its own palette (see comunidade.css and admin.css). */
export type TitleTone = 'gold' | 'cyan';

export interface TitleDefinition {
  id: string;
  label: string;
  description: string;
  tone: TitleTone;
  /** At most one player may hold it (the admin cannot grant it to a second one). */
  single?: boolean;
}

export const TITLES = [
  {
    id: 'primeiro-platinado',
    label: 'Primeiro Platinado',
    description: 'O primeiro jogador a conquistar todas as conquistas.',
    tone: 'gold',
    single: true,
  },
  {
    id: 'turma-zero',
    label: 'Turma Zero',
    description: 'Jogou na fase de testes, antes do lançamento oficial.',
    tone: 'cyan',
  },
] as const satisfies readonly TitleDefinition[];

export type TitleId = (typeof TITLES)[number]['id'];

export const TITLE_IDS = TITLES.map((title) => title.id) as readonly TitleId[];

const BY_ID = new Map<string, TitleDefinition>(TITLES.map((title) => [title.id, title]));

export function titleById(id: string): TitleDefinition | undefined {
  return BY_ID.get(id);
}

export function isTitleId(id: string): id is TitleId {
  return BY_ID.has(id);
}

/**
 * The known titles in a list of ids, highest priority first and without repeats. Unknown ids
 * (a title removed from the catalogue, or a newer server) are dropped.
 */
export function sortTitles(ids: readonly string[] | null | undefined): TitleDefinition[] {
  if (!ids || ids.length === 0) return [];
  const held = new Set(ids);
  return TITLES.filter((title) => held.has(title.id));
}
