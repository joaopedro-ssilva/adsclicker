import type { MetaId, Modifier, StatId, Stats } from '../content/types';
import { STAT_IDS } from '../content/types';

type Target = StatId | MetaId;
export type Totals = Partial<Record<Target, { add: number; pct: number }>>;

const META_KEYS: Record<MetaId, true> = {
  dropExtra: true,
  lootQuality: true,
  commitsGain: true,
  xpGain: true,
  setBonus: true,
  bossDamage: true,
  skillPower: true,
  cooldown: true,
};
export const META_IDS = Object.keys(META_KEYS) as MetaId[];

export const AGILITY_CAP = 500;
export const AGILITY_FLOOR = 20;
export const COOLDOWN_CAP = 80;

export function emptyMeta(): Record<MetaId, number> {
  return { dropExtra: 0, lootQuality: 0, commitsGain: 0, xpGain: 0, setBonus: 0, bossDamage: 0, skillPower: 0, cooldown: 0 };
}

export function addModifier(totals: Totals, modifier: Modifier, factor = 1): void {
  const entry = totals[modifier.target] ?? { add: 0, pct: 0 };
  entry[modifier.op] += modifier.value * factor;
  totals[modifier.target] = entry;
}

export function totalsOf(modifiers: readonly Modifier[]): Totals {
  const totals: Totals = {};
  for (const modifier of modifiers) addModifier(totals, modifier);
  return totals;
}

/** Keeps stats whole numbers inside sane bounds. */
export function clampStats(stats: Stats): Stats {
  const whole = (n: number): number => Math.round(Number.isFinite(n) ? n : 0);
  return {
    logica: Math.max(1, whole(stats.logica)),
    agilidade: Math.min(AGILITY_CAP, Math.max(AGILITY_FLOOR, whole(stats.agilidade))),
    foco: Math.max(1, whole(stats.foco)),
    resiliencia: Math.max(0, whole(stats.resiliencia)),
    atencao: Math.min(100, Math.max(0, whole(stats.atencao))),
    sorte: Math.max(0, whole(stats.sorte)),
  };
}

export function clampMeta(meta: Record<MetaId, number>): Record<MetaId, number> {
  const out = emptyMeta();
  for (const id of META_IDS) {
    const value = Math.round(meta[id] * 100) / 100;
    out[id] = Math.max(0, id === 'cooldown' ? Math.min(COOLDOWN_CAP, value) : value);
  }
  return out;
}

/** Stats: (base + sum of 'add') x (1 + sum of 'pct' / 100). */
export function resolveStats(base: Stats, totals: Totals): Stats {
  const out = { ...base };
  for (const id of STAT_IDS) {
    const entry = totals[id];
    if (entry) out[id] = (base[id] + entry.add) * (1 + entry.pct / 100);
  }
  return clampStats(out);
}

/** Metas are already percentages, so 'add' and 'pct' both add points to them. */
export function resolveMeta(base: Record<MetaId, number>, totals: Totals): Record<MetaId, number> {
  const out = { ...base };
  for (const id of META_IDS) {
    const entry = totals[id];
    if (entry) out[id] = base[id] + entry.add + entry.pct;
  }
  return clampMeta(out);
}
