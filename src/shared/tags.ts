/**
 * Player tags: badges the admin creates on /admin (name, description, colour, who sees it) and
 * gives to players. The catalogue lives in the database (`player_tags`); players hold the ids in
 * `players.titles`. Shared by the server (validation) and the interface (colours).
 *
 * The catalogue is ordered by priority: the first public tag a player holds is the badge shown
 * when space is tight; the others go in the tooltip.
 */

/** Ids of the tags that came with the launch. They are ordinary tags (editable, deletable); a few tools look them up by id. */
export const PRIMEIRO_PLATINADO_TAG = 'primeiro-platinado';
export const TURMA_ZERO_TAG = 'turma-zero';
/** Given by the server to every ranked player whose save holds the "Platina" achievement (see players/sync.ts). */
export const PLATINADO_TAG = 'platinado';
/** Id of the achievement that earns it. */
export const PLATINA_ACHIEVEMENT = 'platinum';

/** public: badge on the boards, the feed and the player's own line. admin: only on /admin. */
export const TAG_VISIBILITIES = ['public', 'admin'] as const;
export type TagVisibility = (typeof TAG_VISIBILITIES)[number];

export const TAG_LABEL_MAX = 24;
export const TAG_DESCRIPTION_MAX = 120;
/** How many tags the catalogue may hold: they are all listed on /admin and loaded with every board. */
export const MAX_TAGS = 50;

/** `#rrggbb`, lower case. */
export const TAG_COLOR_PATTERN = /^#[0-9a-f]{6}$/;

/** Colours offered on /admin before the free picker. The first two are the launch tags'. */
export const TAG_COLOR_PRESETS = ['#f2c744', '#6fd6e6', '#ff6b6b', '#7bd88f', '#b48cff', '#ff9f43', '#f78fb3', '#c8d6e5'] as const;

/** Relative luminance of a `#rrggbb` colour (WCAG), 0 (black) to 1 (white). */
function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** Text colour that reads on a badge of `background`: a dark shade of it on light colours, white on dark ones. */
export function tagTextColor(background: string): string {
  if (!TAG_COLOR_PATTERN.test(background)) return '#111111';
  return luminance(background) > 0.3 ? `color-mix(in srgb, ${background} 22%, #000)` : '#ffffff';
}

/** Lower case, accents and symbols turned into hyphens: the readable part of a new tag's id. */
export function tagSlug(label: string): string {
  const slug = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
    .replace(/-+$/, '');
  return slug === '' ? 'tag' : slug;
}
