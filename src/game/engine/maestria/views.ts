import { MAESTRIA_MAX_LEVEL, PROFESSOR_IDS } from '../../content/types';
import type { GameContent, ProfessorId } from '../../content/types';
import { formatNumber } from '../format';
import type { GameState } from '../state';
import { goldenCanCrit, goldenReady, goldenSeconds, joinhaClicksNeeded } from './joinha';
import { atLevel } from './production';
import { rollforwardJumpMs, rollforwardMaxCharges } from './rollforward';
import { freeSlots, maestriaLevel, maestriaNextCost, unlockedMaestrias } from './slots';
import { swarmCharge, swarmChargeMs } from './swarm';
import type { ActiveSwarm } from './types';

// ---------------------------------------------------------------------------
// Formatura tab: the eight cards
// ---------------------------------------------------------------------------

export interface MaestriaCardView {
  professor: ProfessorId;
  name: string;
  summary: string;
  built: boolean;
  level: number;
  maxLevel: number;
  unlocked: boolean;
  /** A free slot can be put here now. */
  canUnlock: boolean;
  /** Diplomas for the next level, or null at the top or while locked. */
  nextCost: number | null;
  affordable: boolean;
  /** What each level adds, level 1 first. Empty while the Maestria is not built. */
  levels: string[];
}

export interface MaestriasView {
  /** Shown from the first graduation on (or while any Maestria is unlocked). */
  visible: boolean;
  slots: { total: number; used: number; free: number };
  cards: MaestriaCardView[];
}

const whole = (value: number) => formatNumber(value, { integer: true });
const seconds = (ms: number) => `${formatNumber(ms / 1000, { integer: true })} s`;
const times = (value: number) => `×${value.toFixed(2).replace('.', ',').replace(/,?0+$/, '')}`;

/** One line per level for a built Maestria, with the numbers from the content. */
export function maestriaLevelLines(content: GameContent, professor: ProfessorId): string[] {
  const cfg = content.maestrias;
  const lines: string[] = [];
  for (let level = 1; level <= MAESTRIA_MAX_LEVEL; level += 1) {
    if (professor === 'edecio') {
      const j = cfg.joinha;
      let line = `A cada ${whole(atLevel(j.clicksNeeded, level))} cliques, um clique de ouro vale ${whole(atLevel(j.seconds, level))} s da produção.`;
      if (level === j.critFromLevel) line += ' Ele pode ser crítico.';
      if (level === j.holdFromLevel) line += ` Segure o mouse: ${whole(j.holdPerSecond)} cliques por segundo.`;
      lines.push(line);
    } else if (professor === 'gladimir') {
      const r = cfg.rollforward;
      const charges = atLevel(r.maxCharges, level);
      lines.push(
        `Cada carga (${whole(r.clicksToFill)} cliques) avança ${whole(atLevel(r.jumpSeconds, level))} s.` +
          (charges > 1 ? ` Guarda ${charges} cargas.` : ''),
      );
    } else if (professor === 'wagner') {
      const s = cfg.swarm;
      const every = atLevel(s.firewallEveryMs, level);
      lines.push(
        `Carrega em ${whole(atLevel(s.chargeMinutes, level))} min, prêmio ${times(atLevel(s.rewardMult, level))}.` +
          (every > 0 ? ` O firewall derruba um bug a cada ${seconds(every)}.` : ''),
      );
    }
  }
  return lines;
}

export function maestriasView(state: GameState, content: GameContent): MaestriasView {
  const used = unlockedMaestrias(state).length;
  const free = freeSlots(state);
  const cards = PROFESSOR_IDS.map((professor): MaestriaCardView => {
    const def = content.maestrias.defs[professor];
    const level = maestriaLevel(state, professor);
    const nextCost = maestriaNextCost(state, content, professor);
    return {
      professor,
      name: def.name,
      summary: def.summary,
      built: def.built,
      level,
      maxLevel: MAESTRIA_MAX_LEVEL,
      unlocked: level > 0,
      canUnlock: def.built && level === 0 && free > 0,
      nextCost,
      affordable: nextCost !== null && state.diplomas >= nextCost,
      levels: def.built ? maestriaLevelLines(content, professor) : [],
    };
  });
  return {
    visible: state.counters.graduations > 0 || used > 0,
    slots: { total: used + free, used, free },
    cards,
  };
}

// ---------------------------------------------------------------------------
// Stage: the charges and buttons
// ---------------------------------------------------------------------------

export interface JoinhaView {
  level: number;
  /** Manual clicks since the last golden one, and how many the next one needs. */
  clicks: number;
  needed: number;
  /** The next click is golden. */
  ready: boolean;
  seconds: number;
  canCrit: boolean;
  /** Holding the pointer on the professor clicks by itself. */
  canHold: boolean;
  holdPerSecond: number;
}

export function joinhaView(state: GameState, content: GameContent): JoinhaView | null {
  const level = maestriaLevel(state, 'edecio');
  if (level <= 0) return null;
  const needed = joinhaClicksNeeded(state, content);
  return {
    level,
    clicks: Math.min(needed, state.maestria.joinha.clicks),
    needed,
    ready: goldenReady(state, content),
    seconds: goldenSeconds(state, content),
    canCrit: goldenCanCrit(state, content),
    canHold: level >= content.maestrias.joinha.holdFromLevel,
    holdPerSecond: content.maestrias.joinha.holdPerSecond,
  };
}

export interface RollforwardView {
  level: number;
  charges: number;
  maxCharges: number;
  /** Clicks towards the next charge, and how many fill one. */
  clicks: number;
  toFill: number;
  jumpMs: number;
  ready: boolean;
}

export function rollforwardView(state: GameState, content: GameContent): RollforwardView | null {
  const level = maestriaLevel(state, 'gladimir');
  if (level <= 0) return null;
  const roll = state.maestria.rollforward;
  return {
    level,
    charges: roll.charges,
    maxCharges: rollforwardMaxCharges(state, content),
    clicks: roll.clicks,
    toFill: content.maestrias.rollforward.clicksToFill,
    jumpMs: rollforwardJumpMs(state, content),
    ready: roll.charges >= 1,
  };
}

export interface SwarmView {
  level: number;
  /** 0..1 of the charge. */
  charge: number;
  chargeLeftMs: number;
  /** Charged and no swarm in progress. */
  ready: boolean;
  active: ActiveSwarm | null;
  /** Bugs in a swarm, boss apart. */
  bugs: number;
}

/** `now` defaults to the last tick, like abilityViews. */
export function swarmView(state: GameState, content: GameContent, now: number = state.lastTickAt): SwarmView | null {
  const level = maestriaLevel(state, 'wagner');
  if (level <= 0) return null;
  const charge = swarmCharge(state, content, now);
  const total = swarmChargeMs(state, content);
  const active = state.maestria.swarm.active;
  return {
    level,
    charge,
    chargeLeftMs: Math.max(0, total * (1 - charge)),
    ready: active === null && charge >= 1,
    active,
    bugs: content.maestrias.swarm.bugs,
  };
}
