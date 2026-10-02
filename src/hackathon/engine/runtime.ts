import type { EnemyDef, HackathonContent, MetaId, Stats } from '../content/types';
import type { ContentIndex } from './contentIndex';
import type { Stream } from './rng';
import type { EnemyState, FightEvent, Run, RunSetup, RunState } from './types';

/** An enemy alive (or just dead) in the arena, with the bookkeeping `EnemyState` leaves out. */
export interface EnemyRuntime extends EnemyState {
  readonly template: EnemyDef;
  /** Scaled damage of one hit, before ramp. */
  readonly damage: number;
  /** Progress to the next attack, in thousandths of an attack. */
  attackProgress: number;
  attacks: number;
  /** Tick of the next wind-up for enemies with the `charge` trait. */
  nextChargeAt: number | null;
}

/** Everything mutable about a run. `Run.state` is a plain copy of it made after every step. */
export interface Sim {
  readonly content: HackathonContent;
  readonly index: ContentIndex;
  readonly setup: RunSetup;
  /** Waves in the order they will be fought. */
  readonly waves: string[][];
  readonly offers: ([string, string, string] | null)[];
  readonly crit: Stream;
  readonly splash: Stream;
  readonly maxTicks: number;
  readonly noHealing: boolean;
  readonly enemyHpPercent: number;
  readonly enemyDamagePercent: number;
  readonly critSplashChances: number[];
  readonly hasSecondWind: boolean;

  /** Effective stats and meta: the build plus the wave buffs picked so far. */
  stats: Stats;
  meta: Record<MetaId, number>;

  tick: number;
  phase: RunState['phase'];
  wave: number;
  hp: number;
  maxHp: number;
  flowReady: boolean;
  flowAvailableAt: number;
  blockUntil: number;
  hasteUntil: number;
  hasteMultiplier: number;
  stunned: boolean;
  attackProgress: number;
  skills: { id: string; readyAt: number }[];
  enemies: EnemyRuntime[];
  nextUid: number;
  offer: [string, string, string] | null;
  buffs: string[];
  waveTicksLeft: number | null;
  waveStartTick: number;
  secondWindUsed: boolean;
  wavesCleared: number;
  /** Events produced outside a step (the first wave starts when the run is created). */
  pending: FightEvent[];
}

const sims = new WeakMap<Run, Sim>();

export function registerSim(run: Run, sim: Sim): void {
  sims.set(run, sim);
}

export function simOf(run: Run): Sim {
  const sim = sims.get(run);
  if (!sim) throw new Error('hackathon engine: this run was not created by createRun');
  return sim;
}

export function enemyView(enemy: EnemyRuntime): EnemyState {
  return { uid: enemy.uid, def: enemy.def, hp: enemy.hp, maxHp: enemy.maxHp, chargeLandsAt: enemy.chargeLandsAt };
}

export function livingEnemies(sim: Sim): EnemyRuntime[] {
  return sim.enemies.filter((enemy) => enemy.hp > 0);
}

export function toState(sim: Sim): RunState {
  return {
    tick: sim.tick,
    phase: sim.phase,
    wave: sim.wave,
    waveCount: sim.waves.length,
    player: {
      hp: sim.hp,
      maxHp: sim.maxHp,
      flowReady: sim.flowReady,
      flowAvailableAt: sim.flowAvailableAt,
      blockUntil: sim.blockUntil,
      hasteUntil: sim.hasteUntil,
      stunned: sim.stunned,
    },
    enemies: sim.enemies.map(enemyView),
    skills: sim.skills.map((skill) => ({ ...skill })),
    offer: sim.offer ? [sim.offer[0], sim.offer[1], sim.offer[2]] : null,
    buffs: [...sim.buffs],
    waveTicksLeft: sim.waveTicksLeft,
  };
}
