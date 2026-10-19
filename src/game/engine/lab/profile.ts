/**
 * What the public lab profile of a player shows (GET /api/lab/profile): the cosmetics they wear and the lifetime numbers
 * of their lab. `labProfileOf` summarises a save for the server's projection; `readLabProfile` reads a stored row back
 * through the content, so ids the game no longer knows drop out and numbers stay sane whatever the column holds.
 */
import type { GameContent } from '../../content/types';
import type { GameState } from '../state';
import { labCosmeticDef } from './cosmetics';
import type { LabCosmeticKind } from '../../content/labTypes';

export interface LabProfileStats {
  /** Highest phase ever reached. */
  bestPhase: number;
  commitsEarned: number;
  /** Research runs started, monitors broken, phases cleared, bosses beaten. */
  runs: number;
  broken: number;
  phasesCleared: number;
  bossesBeaten: number;
  itemsFound: number;
  itemsRecycled: number;
  itemLevelUps: number;
  affixRerolls: number;
  clicks: number;
  /** Cosmetics owned (the free defaults count). */
  cosmeticsOwned: number;
}

export interface LabProfileData {
  /** Worn: the monitor skin, the lab theme, the decorations on display (in order) and the starting item. */
  monitor: string;
  theme: string;
  decor: string[];
  startItem: string;
  stats: LabProfileStats;
}

const STAT_KEYS: (keyof LabProfileStats)[] = [
  'bestPhase',
  'commitsEarned',
  'runs',
  'broken',
  'phasesCleared',
  'bossesBeaten',
  'itemsFound',
  'itemsRecycled',
  'itemLevelUps',
  'affixRerolls',
  'clicks',
  'cosmeticsOwned',
];

const MAX_STAT = 1e12;

/** The profile of a save; null while the lab was never unlocked (such a player has no lab to show). */
export function labProfileOf(state: GameState, content: GameContent): LabProfileData | null {
  const { lab } = state;
  if (!lab.unlocked) return null;
  const { cosmetics, counters } = lab;
  const owned = content.lab.cosmetics.items.filter((entry) => entry.free || cosmetics.owned[entry.id]).length;
  return {
    monitor: cosmetics.monitor,
    theme: cosmetics.theme,
    decor: [...cosmetics.decor],
    startItem: cosmetics.startItem,
    stats: {
      bestPhase: lab.bestPhase,
      commitsEarned: counters.commitsEarned,
      runs: counters.runs,
      broken: counters.broken,
      phasesCleared: counters.phasesCleared,
      bossesBeaten: counters.bossesBeaten,
      itemsFound: counters.itemsFound,
      itemsRecycled: counters.itemsRecycled,
      itemLevelUps: counters.itemLevelUps,
      affixRerolls: counters.affixRerolls,
      clicks: counters.clicks,
      cosmeticsOwned: owned,
    },
  };
}

/** Reads a stored profile through the content: unknown or wrong-kind ids fall back to the defaults, numbers are clamped. */
export function readLabProfile(value: unknown, content: GameContent): LabProfileData | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const { defaults, decorMax } = content.lab.cosmetics;
  const worn = (id: unknown, kind: LabCosmeticKind, fallback: string): string => {
    const def = typeof id === 'string' ? labCosmeticDef(content, id) : undefined;
    return def && def.kind === kind ? def.id : fallback;
  };
  const decor: string[] = [];
  if (Array.isArray(raw.decor)) {
    for (const id of raw.decor) {
      const def = typeof id === 'string' ? labCosmeticDef(content, id) : undefined;
      if (def?.kind === 'decor' && !decor.includes(def.id) && decor.length < decorMax) decor.push(def.id);
    }
  }
  const rawStats = typeof raw.stats === 'object' && raw.stats !== null ? (raw.stats as Record<string, unknown>) : {};
  const stats = {} as LabProfileStats;
  for (const key of STAT_KEYS) {
    const number = rawStats[key];
    stats[key] = typeof number === 'number' && Number.isFinite(number) ? Math.min(MAX_STAT, Math.max(0, Math.floor(number))) : 0;
  }
  return {
    monitor: worn(raw.monitor, 'monitor', defaults.monitor),
    theme: worn(raw.theme, 'theme', defaults.theme),
    decor,
    startItem: worn(raw.startItem, 'start', defaults.startItem),
    stats,
  };
}
