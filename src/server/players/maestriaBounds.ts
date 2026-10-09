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
  bolsaMaxSeconds,
  festaRechargeMs,
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

/** Seconds of production the abilities a party fires at once can add (their buffs, beyond the boost itself). */
const FESTA_ABILITY_SECONDS = 400;
/** The most one invasion pays, in seconds of production, before the event bonus. */
const INVASION_MAX_SECONDS = 150;

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

  // Festa de lançamento: one party per recharge (and one already waiting). Each pays its boost over its duration, the
  // abilities it fires at once (a flat allowance for their buffs), and the invasions it brings: one per interval, up to 150 s each.
  const festa = maestriaLevel(state, 'guto');
  if (festa > 0) {
    const cfg = content.maestrias.festa;
    const rechargeSeconds = Math.max(1, festaRechargeMs(state, content) / 1000);
    const uses = 1 + (window.seconds + rollforward) / rechargeSeconds;
    const duration = atLevel(cfg.seconds, festa);
    const invasions = Math.ceil(duration / (content.balance.events.minIntervalMs / 1000 * atLevel(cfg.invasions, festa))) + 1;
    const each = duration * Math.max(0, atLevel(cfg.power, festa) - 1) + FESTA_ABILITY_SECONDS + invasions * INVASION_MAX_SECONDS * Math.max(1, stats.eventReward);
    total += uses * each;
  }

  // Bolsa de tokens: the market pays at most a full bucket of profit plus what refills in the window (see engine/maestria/bolsa.ts).
  total += bolsaMaxSeconds(content, maestriaLevel(state, 'pablo'), window.seconds);
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
