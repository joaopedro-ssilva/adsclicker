import type { ItemRarity, MetaId, SlotId, StatId } from '@/hackathon/content';

export const STAT_ORDER: readonly StatId[] = ['logica', 'agilidade', 'foco', 'resiliencia', 'atencao', 'sorte'];
export const META_ORDER: readonly MetaId[] = [
  'dropExtra',
  'lootQuality',
  'commitsGain',
  'xpGain',
  'setBonus',
  'bossDamage',
  'skillPower',
  'cooldown',
];

export interface TargetInfo {
  label: string;
  /** One short line, always visible. */
  hint: string;
  /** The longer explanation, in the tooltip. */
  tip: string;
}

export const STAT_INFO: Record<StatId, TargetInfo> = {
  logica: { label: 'Lógica', hint: 'dano por golpe', tip: 'Lógica: quanto dano cada golpe seu causa.' },
  agilidade: {
    label: 'Agilidade',
    hint: 'golpes por segundo',
    tip: 'Agilidade: velocidade de ataque. 100 equivale a 1 golpe por segundo.',
  },
  foco: { label: 'Foco', hint: 'vida máxima', tip: 'Foco: sua vida máxima. Ela não se recupera entre as ondas.' },
  resiliencia: {
    label: 'Resiliência',
    hint: 'reduz o dano recebido',
    tip: 'Resiliência: o dano que você leva é multiplicado por 100 e dividido por (100 + Resiliência).',
  },
  atencao: {
    label: 'Atenção',
    hint: 'chance de crítico',
    tip: 'Atenção: chance, em %, de um golpe ser crítico. Crítico causa o dobro de dano.',
  },
  sorte: {
    label: 'Sorte',
    hint: 'loot melhor e item extra',
    tip: 'Sorte: melhora a raridade dos drops e a chance de um item extra. Não é usada dentro da luta.',
  },
};

export const META_INFO: Record<MetaId, TargetInfo> = {
  dropExtra: {
    label: 'Item extra',
    hint: 'chance de mais um drop',
    tip: 'Item extra: chance, em %, de a vitória render um item a mais (soma com a base e com a Sorte).',
  },
  lootQuality: {
    label: 'Qualidade do loot',
    hint: 'raridade dos drops',
    tip: 'Qualidade do loot: empurra os sorteios de raridade para cima (raros, épicos e lendários ficam mais comuns).',
  },
  commitsGain: { label: 'Commits ganhos', hint: 'por fase vencida', tip: 'Commits ganhos: % a mais de Commits em cada fase.' },
  xpGain: { label: 'XP ganho', hint: 'por fase', tip: 'XP ganho: % a mais de experiência em cada fase.' },
  setBonus: {
    label: 'Bônus de conjunto',
    hint: 'conjuntos mais fortes',
    tip: 'Bônus de conjunto: % de reforço nos bônus dos conjuntos de itens equipados.',
  },
  bossDamage: { label: 'Dano em chefões', hint: 'contra chefões', tip: 'Dano em chefões: % a mais de dano contra chefões.' },
  skillPower: {
    label: 'Poder das habilidades',
    hint: 'efeito das ativas',
    tip: 'Poder das habilidades: % de reforço no efeito das habilidades ativas.',
  },
  cooldown: {
    label: 'Redução de recarga',
    hint: 'habilidades recarregam antes',
    tip: 'Redução de recarga: % menos tempo de espera entre usos das habilidades (máximo de 80%).',
  },
};

export const SLOT_LABEL: Record<SlotId, string> = {
  ferramenta: 'Ferramenta',
  setup: 'Setup',
  acessorio: 'Acessório',
  amuleto: 'Amuleto',
};

export const RARITY_NAME: Record<ItemRarity, string> = {
  comum: 'Comum',
  incomum: 'Incomum',
  raro: 'Raro',
  epico: 'Épico',
  lendario: 'Lendário',
};

export const RARITY_RANK: Record<ItemRarity, number> = { comum: 1, incomum: 2, raro: 3, epico: 4, lendario: 5 };

export const BRANCH_LABEL = { codigo: 'Código', infra: 'Infra', produto: 'Produto' } as const;

export function isStat(target: string): target is StatId {
  return target in STAT_INFO;
}

export function targetInfo(target: StatId | MetaId): TargetInfo {
  return isStat(target) ? STAT_INFO[target] : META_INFO[target];
}

/** pt-BR number with at most `decimals` decimals and no trailing zero: 12.5 -> "12,5". */
export function num(value: number, decimals = 1): string {
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return String(rounded).replace('.', ',');
}

export function signed(value: number, decimals = 1): string {
  return `${value < 0 ? '−' : '+'}${num(Math.abs(value), decimals)}`;
}

/** Whole numbers with thousands dots: 1234 -> "1.234". */
export function whole(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export interface AffixView {
  value: string;
  label: string;
}

/** "+12" "Lógica", "+5%" "Lógica", "+3%" "Item extra". */
export function affixView(affix: { target: StatId | MetaId; op: 'add' | 'pct'; value: number }): AffixView {
  const percent = affix.op === 'pct' || !isStat(affix.target);
  return { value: `${signed(affix.value)}${percent ? '%' : ''}`, label: targetInfo(affix.target).label };
}

/** How a stat reads for the player: agility as hits per second, attention as a percentage. */
export function statValue(stat: StatId, value: number): string {
  if (stat === 'agilidade') return `${num(value / 100, 2)}/s`;
  if (stat === 'atencao') return `${whole(value)}%`;
  return whole(value);
}

export function metaValue(value: number): string {
  return `${num(value)}%`;
}
