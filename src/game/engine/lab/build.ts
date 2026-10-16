import { LAB_RARITIES, LAB_SLOTS } from '../../content/labTypes';
import type { GameContent } from '../../content/types';
import { Decimal } from '../decimal';
import type { GameState } from '../state';
import { labIndex } from './state';
import type { LabBuild, LabBuildItem, LabState } from './types';

// The build a record was set with: the four equipped items, trimmed to what a board shows (base, rarity, level). It is
// copied when the record is set, so it keeps describing that moment after the items change or the turma graduates.

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The equipped items right now, in slot order. */
export function snapshotLabBuild(lab: LabState): LabBuild {
  const build: LabBuild = [];
  for (const slot of LAB_SLOTS) {
    const item = lab.turma.equipped[slot];
    if (item) build.push({ slot, base: item.base, rarity: item.rarity, level: item.level });
  }
  return build;
}

/**
 * Reads a build from a save or from the database. Only what the content knows survives: the base must exist and sit in
 * its own slot, the rarity must be a real one, the level is held to 1..max. One item per slot, in slot order. Anything
 * else (not an array, junk entries) gives what is left, down to an empty build.
 */
export function readLabBuild(value: unknown, content: GameContent): LabBuild {
  if (!Array.isArray(value)) return [];
  const index = labIndex(content);
  const bySlot = new Map<string, LabBuildItem>();
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.base !== 'string') continue;
    const base = index.bases.get(entry.base);
    const rarity = LAB_RARITIES.find((id) => id === entry.rarity);
    if (!base || !rarity || bySlot.has(base.slot)) continue;
    const raw = typeof entry.level === 'number' && Number.isFinite(entry.level) ? Math.floor(entry.level) : 1;
    bySlot.set(base.slot, { slot: base.slot, base: base.id, rarity, level: Math.min(content.lab.items.maxLevel, Math.max(1, raw)) });
  }
  return LAB_SLOTS.flatMap((slot) => {
    const item = bySlot.get(slot);
    return item ? [item] : [];
  });
}

/**
 * Files `phase` as the highest reached. A new best copies the build; `refresh` also renews the copy of a best that the
 * current run is still sitting on (the run ends, or the turma graduates, with the final build of that record).
 */
export function noteBestPhase(lab: LabState, phase: number, refresh = false): void {
  if (phase > lab.bestPhase) {
    lab.bestPhase = phase;
    lab.bestPhaseBuild = snapshotLabBuild(lab);
  } else if (refresh && phase === lab.bestPhase && lab.turma.run?.phase === phase) {
    lab.bestPhaseBuild = snapshotLabBuild(lab);
  }
}

/**
 * The best run (most ADScoins in one turma) and the build it was made with: the record of the graduations, or the run
 * in progress when that is already ahead. The coins are what the board ranks; the build is the equipped items then.
 */
export function bestRunRecord(state: GameState): { coins: Decimal; build: LabBuild } {
  const live = state.runCoins.gt(state.records.mostCoins);
  return live ? { coins: state.runCoins, build: snapshotLabBuild(state.lab) } : { coins: state.records.mostCoins, build: state.lab.bestRunBuild };
}
