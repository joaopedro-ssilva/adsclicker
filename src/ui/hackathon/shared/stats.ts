import type { MetaId, StatId } from '@/hackathon/content';

export const STAT_LABEL: Record<StatId, string> = {
  logica: 'Lógica',
  agilidade: 'Agilidade',
  foco: 'Foco',
  resiliencia: 'Resiliência',
  atencao: 'Atenção',
  sorte: 'Sorte',
};

export const META_LABEL: Record<MetaId, string> = {
  dropExtra: 'Item extra',
  lootQuality: 'Qualidade do loot',
  commitsGain: 'Commits ganhos',
  xpGain: 'XP ganho',
  setBonus: 'Bônus de conjunto',
  bossDamage: 'Dano em chefões',
  skillPower: 'Poder das habilidades',
  cooldown: 'Redução de recarga',
};

const isStat = (target: string): target is StatId => target in STAT_LABEL;

/** "+12 Lógica", "+5% Lógica", "+3% Item extra". */
export function affixText(affix: { target: StatId | MetaId; op: 'add' | 'pct'; value: number }): string {
  const percent = affix.op === 'pct' || !isStat(affix.target);
  const value = Math.round(affix.value * 10) / 10;
  const label = isStat(affix.target) ? STAT_LABEL[affix.target] : META_LABEL[affix.target];
  return `${value < 0 ? '−' : '+'}${String(Math.abs(value)).replace('.', ',')}${percent ? '%' : ''} ${label}`;
}
