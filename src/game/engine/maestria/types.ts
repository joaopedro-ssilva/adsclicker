import type { Decimal } from '../decimal';
import type { ProfessorId } from '../../content/types';

/** One bug of a Super invasão. Positions are 0..1 on each axis of the stage. */
export interface SwarmBug {
  uid: number;
  /** Id of the kind in the swarm config (the boss has its own). */
  kind: string;
  boss: boolean;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  /** When it escapes (the boss stays until the swarm ends). */
  expiresAt: number;
}

export interface ActiveSwarm {
  uid: number;
  startedAt: number;
  endsAt: number;
  bugs: SwarmBug[];
  /** Regular bugs that appeared so far, escaped ones included. */
  spawned: number;
  defeated: number;
  escaped: number;
  bossSpawned: boolean;
  bossDefeated: boolean;
  /** When the firewall hits next. 0 = no firewall. */
  nextAutoAt: number;
  /** Counter behind SwarmBug.uid. */
  bugSeq: number;
}

/** What a Super invasão paid, kept for the summary. */
export interface SwarmResult {
  uid: number;
  defeated: number;
  total: number;
  bossDefeated: boolean;
  cleared: boolean;
  seconds: number;
}

/** Everything the Maestrias remember. Survives graduation except the run counters noted below. */
export interface MaestriaState {
  /** Professor -> level (1..5) of the Maestria that got a slot. Missing = not unlocked. */
  levels: Partial<Record<ProfessorId, number>>;
  /** Joinha de Ouro. `clicks` = manual clicks since the last golden one. Reset at graduation. */
  joinha: { clicks: number };
  /** Rollforward. `clicks` fills the next charge, `charges` are the full ones stored. Reset at graduation. */
  rollforward: { clicks: number; charges: number };
  /** Super invasão. `since` = when the charge started filling (epoch ms); it survives graduation. */
  swarm: { since: number; seq: number; active: ActiveSwarm | null };
  /** Festa de lançamento. `since` = when the recharge started (epoch ms); it survives graduation. The party itself is a buff. */
  festa: { since: number };
  /** Horas complementares: hours counted in the run, by activity. Paid and cleared at graduation. */
  horas: HorasState;
  /** Bolsa de tokens: the market and what the player holds. Prices survive graduation; the holdings are cashed in. */
  bolsa: BolsaState;
}

export interface HorasState {
  clicks: number;
  invasions: number;
  sprints: number;
  abilities: number;
  levels: number;
}

export interface BolsaHolding {
  /** Shares: coins paid divided by the price of each purchase. Worth `units x price` now. */
  units: Decimal;
  /** Coins paid and not taken back yet. */
  cost: Decimal;
}

export interface BolsaAssetState {
  price: number;
  /** The last prices, oldest first, for the sparkline. */
  history: number[];
  held: BolsaHolding;
}

export interface BolsaState {
  /** Game time of the last price step (epoch ms). 0 = the market never opened. */
  at: number;
  /** Price steps so far; the cyclic assets follow it. */
  step: number;
  /** Growth index of the Fundo (1 at the start, it only goes up). */
  fundIndex: number;
  fund: BolsaHolding;
  /** Profit the market can still pay, in seconds of the class's production. It refills with time. */
  liquidity: number;
  assets: Record<string, BolsaAssetState>;
}
