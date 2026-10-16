/**
 * The Laboratório wardrobe: monitor skins, lab themes, decoration objects and starting items, with their prices and
 * (for the starting items) their small effects. Art lives in public/assets (hi-res, see the `lab-decor` and `lab-start`
 * sheets); skins and themes are CSS only (ui/game/lab/cosmetics.css), keyed by the ids below.
 *
 * Every price is a fixed ADScoins number in ONE place: the tiers below. The lab grows the economy a lot, so the shop is a
 * coin sink in the Oc..Qad range (1e27..1e45). A `null` price means "not sold": a default, or an achievement reward that a
 * later change grants with `grantLabCosmetic`.
 */
import { achievements } from './achievements';
import type { LabCosmeticDef, LabEffects } from './labTypes';

export interface LabCosmeticArt {
  id: string;
  name: string;
  /** Asset key relative to public/assets, without extension. */
  art: string;
}

const decor = (id: string, name: string): LabCosmeticArt => ({
  id,
  name,
  art: `lab/decor/${id}`,
});
const start = (id: string, name: string): LabCosmeticArt => ({
  id,
  name,
  art: `lab/start/${id}`,
});

export const labDecor: LabCosmeticArt[] = [
  decor('poster-funciona-na-minha-maquina', 'Pôster "Funciona na minha máquina"'),
  decor('caneca-do-plantao', 'Caneca do Plantão'),
  decor('luz-neon-codigo', 'Luz neon "</>"'),
  decor('lixeira-reciclagem', 'Lixeira de reciclagem'),
  decor('gato-dormindo-no-monitor', 'Gato dormindo no monitor'),
  decor('luminaria', 'Luminária'),
  decor('quadro-branco-diagrama', 'Quadro branco com diagrama'),
  decor('pilha-de-livros-de-algoritmos', 'Pilha de livros de algoritmos'),
  decor('trofeu-de-hackathon', 'Troféu de hackathon'),
  decor('cacto', 'Cacto'),
  decor('fones-pendurados', 'Fones pendurados'),
  decor('mini-servidor', 'Mini servidor com LEDs'),
];

export const labStartItems: LabCosmeticArt[] = [
  start('mouse-dourado', 'Mouse dourado'),
  start('mouse-com-fita-colorida', 'Mouse com fita colorida'),
  start('mouse-de-bolinha', 'Mouse de bolinha'),
  start('trackball', 'Trackball'),
  start('teclado-de-membrana-velho', 'Teclado de membrana velho'),
  start('mousepad-gamer-rgb', 'Mousepad gamer RGB'),
];

// ---------------------------------------------------------------------------
// Prices: fixed ADScoins, by tier (Oc = 1e27 ... Qad = 1e45). Edit them here and nowhere else.
// ---------------------------------------------------------------------------

/** What a cosmetic that is not for sale says: the achievement that hands it out (a secret one keeps its name hidden). */
function conquista(id: string): string {
  const def = achievements.find((entry) => entry.reward?.labCosmetic === id);
  if (!def) return 'Conquista';
  return def.secret ? 'Conquista secreta: ???' : `Conquista: ${def.name}`;
}

/** Decorations: 1e27 .. 1e33. */
const DECOR_PRICE: Record<string, string | null> = {
  cacto: '1e27',
  'caneca-do-plantao': '2e27',
  'fones-pendurados': '5e27',
  'lixeira-reciclagem': '1e28',
  luminaria: '3e28',
  'pilha-de-livros-de-algoritmos': '1e29',
  'poster-funciona-na-minha-maquina': '3e29',
  'quadro-branco-diagrama': '1e30',
  'luz-neon-codigo': '3e30',
  'mini-servidor': '1e33',
  'gato-dormindo-no-monitor': null, // achievement
  'trofeu-de-hackathon': null, // achievement
};

/** Monitor skins and lab themes: 1e33 .. 1e42. */
const MONITOR_PRICE: Record<string, string | null> = {
  'monitor-crt-bege': null, // the default
  'monitor-gamer-rgb': '1e33',
  'monitor-ultrawide': '1e36',
  'monitor-tela-azul': '1e39',
  'monitor-tubo-adesivado': '1e42',
};
const THEME_PRICE: Record<string, string | null> = {
  'tema-fosforo': null, // the default
  'tema-tela-azul': '1e34',
  'tema-madrugada': '1e37',
  'tema-masmorra': '1e40',
  'tema-grimorio': null, // achievement
};

/** Starting items: 1e36 .. 1e45. */
const START_PRICE: Record<string, string | null> = {
  'mouse-de-bolinha': '1e36',
  'mouse-com-fita-colorida': '1e38',
  'teclado-de-membrana-velho': '1e40',
  trackball: '1e42',
  'mouse-dourado': '1e45',
  'mousepad-gamer-rgb': null, // achievement
};

// ---------------------------------------------------------------------------
// Starting items: the small effect each gives while it is the run's ferramenta (the Mouse quebrado gives none).
// Weak on purpose: a nudge to start a little better, nothing the tree does not already do much more of.
// ---------------------------------------------------------------------------

export const START_ITEM_EFFECTS: Record<string, LabEffects> = {
  'mouse-dourado': { commits: 0.1 },
  'mouse-com-fita-colorida': { integrityFlat: 10 },
  'mouse-de-bolinha': { luck: 5 },
  trackball: { damage: 0.06 },
  'teclado-de-membrana-velho': { firstBossTime: 1 },
  'mousepad-gamer-rgb': { clickDamage: 0.1 },
};

const START_TEXT: Record<string, string> = {
  'mouse-dourado': '+10% de Commits ganhos.',
  'mouse-com-fita-colorida': '+10 de integridade máxima.',
  'mouse-de-bolinha': '+5 de sorte: itens um pouco melhores.',
  trackball: '+6% de dano automático.',
  'teclado-de-membrana-velho': '+1 s no prazo do primeiro chefão.',
  'mousepad-gamer-rgb': '+10% de dano do clique no monitor.',
};

// ---------------------------------------------------------------------------
// The catalogue
// ---------------------------------------------------------------------------

const MONITORS: Omit<LabCosmeticDef, 'kind' | 'price'>[] = [
  {
    id: 'monitor-crt-bege',
    name: 'CRT Bege 1998',
    description: 'O clássico: plástico amarelado e brilho verde de fósforo.',
    free: true,
  },
  {
    id: 'monitor-gamer-rgb',
    name: 'Gamer RGB',
    description: 'Moldura que muda de cor o tempo todo. Mais FPS, garantido.',
  },
  {
    id: 'monitor-ultrawide',
    name: 'Ultrawide Curvo',
    description: 'Borda fininha, tela larga e curva. Cabe até o log de erros.',
  },
  {
    id: 'monitor-tela-azul',
    name: 'Tela Azul',
    description: 'Um erro fatal tão bonito que dá vontade de deixar assim.',
  },
  {
    id: 'monitor-tubo-adesivado',
    name: 'Tubo Adesivado',
    description: 'Tubo enorme coberto de adesivos de cada versão do semestre.',
  },
];

const THEMES: Omit<LabCosmeticDef, 'kind' | 'price'>[] = [
  {
    id: 'tema-fosforo',
    name: 'Fósforo Verde',
    description: 'Terminal verde sobre preto. O laboratório de sempre.',
    free: true,
  },
  {
    id: 'tema-tela-azul',
    name: 'Tela Azul',
    description: 'Azul de erro fatal, painéis brancos e muita saudade do Windows.',
  },
  {
    id: 'tema-madrugada',
    name: 'Madrugada',
    description: 'Azul e roxo de quem vira a noite no deploy.',
  },
  {
    id: 'tema-masmorra',
    name: 'Masmorra',
    description: 'Pedra fria e ouro velho. Pesquisa com cheiro de tocha.',
  },
  {
    id: 'tema-grimorio',
    name: 'Grimório',
    description: 'Couro velho, páginas amareladas e tinta dourada. Pesquisa à moda antiga.',
  },
];

const item = (kind: LabCosmeticDef['kind'], base: Omit<LabCosmeticDef, 'kind' | 'price'>, price: string | null | undefined): LabCosmeticDef => ({
  ...base,
  kind,
  price: price ?? null,
  ...(price === null || price === undefined ? (base.free ? {} : { hint: conquista(base.id) }) : {}),
});

/** The Mouse quebrado: what a run starts with until another starting item is equipped. Not a shop item. */
export const DEFAULT_START_ITEM = 'mouse-quebrado';

export const labCosmeticItems: LabCosmeticDef[] = [
  ...MONITORS.map((entry) => item('monitor', entry, MONITOR_PRICE[entry.id])),
  ...THEMES.map((entry) => item('theme', entry, THEME_PRICE[entry.id])),
  ...labDecor.map((entry) =>
    item(
      'decor',
      {
        id: entry.id,
        name: entry.name,
        description: 'Enfeite para a mesa do laboratório.',
        art: entry.art,
      },
      DECOR_PRICE[entry.id],
    ),
  ),
  {
    id: DEFAULT_START_ITEM,
    kind: 'start',
    name: 'Mouse quebrado',
    description: 'Clica quando quer. Sem efeito nenhum.',
    price: null,
    free: true,
    art: 'hackathon/items/mouse-quebrado',
  },
  ...labStartItems.map((entry) =>
    item(
      'start',
      {
        id: entry.id,
        name: entry.name,
        description: START_TEXT[entry.id] ?? '',
        art: entry.art,
      },
      START_PRICE[entry.id],
    ),
  ),
];

/** Decorations on display at once. */
export const LAB_DECOR_MAX = 4;
