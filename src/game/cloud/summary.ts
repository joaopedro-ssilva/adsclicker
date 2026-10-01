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

/** Which save has gone further, by ADScoins produced in the lifetime, then by play time. */
export function moreProgress(local: SaveSummary, cloud: SaveSummary): 'local' | 'cloud' | 'tie' {
  const a = parseDecimal(local.lifetimeCoins);
  const b = parseDecimal(cloud.lifetimeCoins);
  if (a.gt(b)) return 'local';
  if (a.lt(b)) return 'cloud';
  if (local.playSeconds === cloud.playSeconds) return 'tie';
  return local.playSeconds > cloud.playSeconds ? 'local' : 'cloud';
}

/** A device with no real progress, which can take the cloud save without asking. */
export function isFreshDevice(summary: SaveSummary): boolean {
  return summary.playSeconds <= MEANINGFUL_PLAY_SECONDS;
}
