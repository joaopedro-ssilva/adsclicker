import { PROFESSOR_IDS } from '@/game/content/types';
import type { GameState } from '@/game/engine/state';
import { bestRunRecord } from '@/game/engine/lab/build';
import type { LabBuild } from '@/game/engine/lab/types';
import { MAX_COIN_EXPONENT } from './plausibility';

/** The highest lab phase a row can hold (the save reader's own ceiling). */
export const MAX_LAB_PHASE = 100_000;

/** The leaderboard columns of a player, derived from the save (see the "Projection" block of the schema). */
export interface Projection {
  lifetimeCoinsText: string;
  /** Same number for the `numeric` column; Postgres reads the engine's "1.5e+300" notation. */
  lifetimeCoins: string;
  lifetimeCoinsLog: number;
  diplomasEarned: number;
  graduations: number;
  clicks: number;
  achievements: number;
  professors: number;
  playSeconds: number;
  avatarProfessor: string;
  avatarSkin: string;
  /** Laboratório boards: the highest phase and the best turma (most coins in one run), each with its build. Never trusted beyond the save's own sanitising and the judge. */
  labBestPhase: number;
  labBestPhaseBuild: LabBuild | null;
  bestRunCoinsText: string;
  bestRunCoinsLog: number;
  bestRunBuild: LabBuild | null;
}

/** True when the coins are too large to store (exponent beyond MAX_COIN_EXPONENT). */
export function coinsOutOfRange(state: GameState): boolean {
  return state.lifetimeCoins.e > MAX_COIN_EXPONENT;
}

const safeInt = (value: number): number => Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(value)));

export function projectState(state: GameState): Projection {
  const coins = state.lifetimeCoins;
  const text = coins.toString();
  const bestRun = bestRunRecord(state);
  return {
    lifetimeCoinsText: text,
    lifetimeCoins: text,
    // Below 1 coin the log is negative or minus infinity; 0 keeps the column finite and orderable.
    lifetimeCoinsLog: coins.lte(1) ? 0 : coins.log10(),
    diplomasEarned: safeInt(state.diplomasEarned),
    graduations: safeInt(state.counters.graduations),
    clicks: safeInt(state.counters.clicks),
    achievements: Object.keys(state.achievements).length,
    professors: PROFESSOR_IDS.filter((id) => state.hired[id]).length,
    playSeconds: safeInt(state.counters.playSeconds),
    avatarProfessor: state.activeProfessor,
    avatarSkin: state.equippedSkin[state.activeProfessor] ?? '',
    labBestPhase: state.lab.unlocked ? Math.min(MAX_LAB_PHASE, Math.max(0, Math.floor(state.lab.bestPhase))) : 0,
    labBestPhaseBuild: state.lab.unlocked && state.lab.bestPhaseBuild.length > 0 ? state.lab.bestPhaseBuild : null,
    bestRunCoinsText: bestRun.coins.toString(),
    bestRunCoinsLog: bestRun.coins.lte(1) ? 0 : bestRun.coins.log10(),
    bestRunBuild: state.lab.unlocked && bestRun.build.length > 0 ? bestRun.build : null,
  };
}
