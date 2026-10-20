import type { SaveSummary } from '@/shared/api';
import { PROFESSOR_IDS } from '../content/types';
import { parseDecimal } from '../engine/decimal';
import type { GameState } from '../engine/state';

/** Play time below which a device counts as "fresh": nothing worth asking the player about. */
export const MEANINGFUL_PLAY_SECONDS = 60;

/** The same few numbers the server derives from a cloud save, computed from the live state. */
export function summarizeState(state: GameState): SaveSummary {
  return {
    lifetimeCoins: state.lifetimeCoins.toString(),
    diplomasEarned: state.diplomasEarned,
    professors: PROFESSOR_IDS.filter((id) => state.hired[id]).length,
    achievements: Object.keys(state.achievements).length,
    playSeconds: Math.floor(state.counters.playSeconds),
  };
}

/** True when the two saves describe the same progress (play time and save dates are ignored). */
export function sameProgress(a: SaveSummary, b: SaveSummary): boolean {
  return (
    parseDecimal(a.lifetimeCoins).eq(parseDecimal(b.lifetimeCoins)) &&
    a.diplomasEarned === b.diplomasEarned &&
    a.professors === b.professors &&
    a.achievements === b.achievements
  );
}

export type ProgressDominance = 'local' | 'cloud' | 'tie' | 'mixed';

/**
 * Which save has gone further across permanent milestones (diplomas, achievements, professors),
 * invested play time, and lifetime coins.
 *
 * - 'tie': Both saves are identical in all tracked progress metrics.
 * - 'local': Local strictly dominates or matches cloud across all metrics, with at least one higher.
 * - 'cloud': Cloud strictly dominates or matches local across all metrics, with at least one higher.
 * - 'mixed': Saves have branched or progressed in different dimensions (e.g. one has more diplomas
 *   while the other collected more offline coins). Neither should be recommended over the other.
 */
export function moreProgress(local: SaveSummary, cloud: SaveSummary): ProgressDominance {
  const localCoins = parseDecimal(local.lifetimeCoins);
  const cloudCoins = parseDecimal(cloud.lifetimeCoins);

  const localWins =
    local.diplomasEarned > cloud.diplomasEarned ||
    local.professors > cloud.professors ||
    local.achievements > cloud.achievements ||
    local.playSeconds > cloud.playSeconds ||
    localCoins.gt(cloudCoins);

  const cloudWins =
    cloud.diplomasEarned > local.diplomasEarned ||
    cloud.professors > local.professors ||
    cloud.achievements > local.achievements ||
    cloud.playSeconds > local.playSeconds ||
    cloudCoins.gt(localCoins);

  if (!localWins && !cloudWins) return 'tie';
  if (localWins && !cloudWins) return 'local';
  if (cloudWins && !localWins) return 'cloud';
  return 'mixed';
}


/** A device with no real progress, which can take the cloud save without asking. */
export function isFreshDevice(summary: SaveSummary): boolean {
  return summary.playSeconds <= MEANINGFUL_PLAY_SECONDS;
}
