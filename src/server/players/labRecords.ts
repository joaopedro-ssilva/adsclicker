/**
 * Plausibility of the Laboratório records (docs/BACKEND.md, "Ranking do Laboratório"): the highest phase and the best
 * turma. Both are permanent and both are shown to everybody, so a forged one is worth more than a few coins. The
 * checks run inside `judgeSave`, so a failure flags the player the same way and takes them off every board.
 *
 * What is checked, and why it holds for honest play:
 * - A lab that was never unlocked has no phase and no build (the engine only starts a run in an unlocked lab).
 * - Records never go down (a rollback or a forced overwrite has no baseline and is judged like a first sync).
 * - `bestPhase` is reached by clearing phases, and `counters.phasesCleared` counts every one of them, so
 *   `bestPhase - 1 <= phasesCleared`, and it grows at most by the phases cleared since the last sync, plus one.
 * - Phases take time. One step of the fight is 0.1 s, and between two phases a human picks a reward (at least a
 *   key press), so `LAB_MIN_PHASE_SECONDS` = 1 s per phase is far below what honest play does (the simulated player
 *   with the full tree needs about 6 s per phase) and the record can grow at most by `window / 1 s` + a grace.
 * - The best turma never beats the lifetime coins (a turma's coins are part of them), never goes down, and grows at
 *   most by what the lifetime coins grew (the live run counts for the record, so each sync already carried it).
 */
import type { Decimal } from '@/game/engine';
import { bestRunRecord } from '@/game/engine/lab/build';
import type { GameState } from '@/game/engine/state';
import { BACKWARDS_TOLERANCE, TIME_GRACE_SECONDS } from './plausibility';

/** Least seconds a phase can honestly take (fight steps and the pick of a reward). */
export const LAB_MIN_PHASE_SECONDS = 1;

/** Phases a sync may add beyond the time rule: the first phase of a run, a boss clear in the same breath, rounding. */
export const LAB_PHASE_GRACE = 3;

export interface LabRecordsInput {
  previous: GameState | null;
  next: GameState;
  /** Seconds of the window to hold the growth to: real seconds since the last sync, or the play time for a first sync. */
  seconds: number;
  /** Share (0..1) of the time grace this window earns (short windows get little of it). */
  allowance: number;
  /** Lifetime coins gained in the window (all of them for a first sync). */
  gain: Decimal;
}

/** Null when the records are plausible, the reason otherwise. */
export function judgeLabRecords({ previous, next, seconds, allowance, gain }: LabRecordsInput): string | null {
  const lab = next.lab;
  const bestRun = bestRunRecord(next);

  if (!lab.unlocked && (lab.bestPhase > 0 || lab.bestPhaseBuild.length > 0 || lab.bestRunBuild.length > 0)) {
    return 'lab record without the lab unlocked';
  }

  // The best turma: a part of the lifetime coins.
  if (bestRun.coins.gt(next.lifetimeCoins.mul(1 + BACKWARDS_TOLERANCE))) return 'best run above the lifetime coins';
  const prevBest = previous ? bestRunRecord(previous).coins : null;
  if (prevBest) {
    if (bestRun.coins.lt(prevBest.mul(1 - BACKWARDS_TOLERANCE))) return 'best run went backwards';
    const grew = bestRun.coins.sub(prevBest);
    if (grew.gt(gain.add(next.lifetimeCoins.mul(BACKWARDS_TOLERANCE)))) return 'best run grew more than the coins gained';
  }

  // The highest phase.
  if (lab.bestPhase - 1 > lab.counters.phasesCleared) return 'lab phase beyond the phases cleared';
  const before = previous?.lab.bestPhase ?? 0;
  if (lab.bestPhase < before) return 'lab phase went backwards';
  const added = lab.bestPhase - before;
  const cleared = previous ? Math.max(0, lab.counters.phasesCleared - previous.lab.counters.phasesCleared) : lab.counters.phasesCleared;
  const window = Math.max(0, seconds) + TIME_GRACE_SECONDS * allowance;
  if (added > cleared + 1) return 'lab phase grew more than the phases cleared';
  if (added > window / LAB_MIN_PHASE_SECONDS + LAB_PHASE_GRACE * allowance + 1) return 'lab phase grew faster than a run can clear phases';
  return null;
}
