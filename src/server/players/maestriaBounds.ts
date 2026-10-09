/**
 * What the Maestrias can add to a save inside one sync window, for the plausibility check. Every reward
 * is a number of seconds of the class's production (see engine/maestria), so the answer is in seconds:
 * the caller multiplies it by the state's coins/second. The bounds come from the state's own levels, so a
 * save without a Maestria gets nothing and a cheated level is caught by the slot and diploma checks.
 */
import { MAESTRIA_MAX_LEVEL, PROFESSOR_IDS } from '@/game/content/types';
import type { GameContent } from '@/game/content/types';
import {
  atLevel,
  goldenCanCrit,
  maestriaLevel,
  maestriaSpent,
  rollforwardJumpMs,
  rollforwardMaxCharges,
  swarmChargeMs,
  swarmMaxSeconds,
  unlockedMaestrias,
} from '@/game/engine/maestria';
import type { GameState } from '@/game/engine/state';
import type { Stats } from '@/game/engine/stats';

export interface MaestriaWindow {
  /** Most manual clicks the window can hold (the engine's click limit over the window, plus the grace). */
  clicks: number;
  /** The window in seconds, grace included. */
  seconds: number;
}

/** Seconds of production the Maestrias of `state` can pay in the window. */
export function maestriaLumpSeconds(state: GameState, content: GameContent, stats: Stats, window: MaestriaWindow): number {
  const cfg = content.maestrias;
  let total = 0;

  // Joinha de Ouro: one golden click per (needed + 1) clicks, plus one already waiting, each worth its seconds (crit included).
  const joinha = maestriaLevel(state, 'edecio');
  if (joinha > 0) {
    const needed = atLevel(cfg.joinha.clicksNeeded, joinha);
    const each = atLevel(cfg.joinha.seconds, joinha) * (goldenCanCrit(state, content) ? stats.critMult : 1);
    total += (window.clicks / (needed + 1) + 1) * each;
  }

  // Rollforward: the charges stored plus the ones the window's clicks can fill, each a jump of production.
  let rollforward = 0;
  if (maestriaLevel(state, 'gladimir') > 0) {
    const uses = rollforwardMaxCharges(state, content) + window.clicks / cfg.rollforward.clicksToFill;
    rollforward = uses * (rollforwardJumpMs(state, content) / 1000);
    total += rollforward;
  }

  // Super invasão: one per charge time of the window (the Rollforward also moves the charge), and one already full.
  const swarm = maestriaLevel(state, 'wagner');
  if (swarm > 0) {
    const chargeSeconds = Math.max(1, swarmChargeMs(state, content) / 1000);
    const uses = 1 + (window.seconds + rollforward) / chargeSeconds;
    total += uses * swarmMaxSeconds(content, swarm) * Math.max(1, stats.eventReward);
  }
  return total;
}

/** Diplomas paid for the Maestria levels of a save. */
export function maestriaDiplomasSpent(state: GameState, content: GameContent): number {
  let total = 0;
  for (const id of PROFESSOR_IDS) total += maestriaSpent(content, id, Math.min(MAESTRIA_MAX_LEVEL, maestriaLevel(state, id)));
  return total;
}

export function maestriaSlotsUsed(state: GameState): number {
  return unlockedMaestrias(state).length;
}
