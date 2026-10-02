import type { EnemyTrait } from '../content/types';
import { TICK_MS } from './types';
import type { FightEvent } from './types';
import type { EnemyRuntime, Sim } from './runtime';
import { enemyView } from './runtime';

/** Ticks in one second. */
export const TICKS_PER_SECOND = 1000 / TICK_MS;

export function msToTicks(ms: number): number {
  return Math.max(1, Math.ceil(ms / TICK_MS));
}

/** Base value grown by the stage level and the daily modifiers, in whole numbers (at least 1). */
function scaled(base: number, level: number, perLevelPercent: number, extraPercent: number): number {
  const percent = Math.max(1, 100 + perLevelPercent * (level - 1) + extraPercent);
  return Math.max(1, Math.round((base * percent) / 100));
}

export function traitsOf<K extends EnemyTrait['kind']>(enemy: EnemyRuntime, kind: K): Extract<EnemyTrait, { kind: K }>[] {
  return enemy.template.traits.filter((t): t is Extract<EnemyTrait, { kind: K }> => t.kind === kind);
}

export function spawnEnemy(sim: Sim, defId: string): EnemyRuntime | null {
  const template = sim.index.enemies.get(defId);
  if (!template) return null;
  const { enemyScaling } = sim.content.config;
  const level = sim.setup.stage.level;
  const maxHp = scaled(template.hp, level, enemyScaling.hpPercentPerLevel, sim.enemyHpPercent);
  const enemy: EnemyRuntime = {
    uid: sim.nextUid,
    def: template.id,
    hp: maxHp,
    maxHp,
    chargeLandsAt: null,
    template,
    damage: scaled(template.damage, level, enemyScaling.damagePercentPerLevel, sim.enemyDamagePercent),
    attackProgress: 0,
    attacks: 0,
    nextChargeAt: null,
  };
  sim.nextUid += 1;
  const charge = traitsOf(enemy, 'charge')[0];
  if (charge) enemy.nextChargeAt = sim.tick + Math.round(charge.everySeconds * TICKS_PER_SECOND);
  return enemy;
}

/** Puts the current wave in the arena and starts its timer. */
export function startWave(sim: Sim, events: FightEvent[]): void {
  sim.enemies = [];
  for (const id of sim.waves[sim.wave] ?? []) {
    const enemy = spawnEnemy(sim, id);
    if (enemy) sim.enemies.push(enemy);
  }
  sim.waveStartTick = sim.tick;
  const timers = sim.enemies.flatMap((enemy) => traitsOf(enemy, 'timer').map((t) => t.seconds));
  sim.waveTicksLeft = timers.length > 0 ? Math.round(Math.min(...timers) * TICKS_PER_SECOND) : null;
  events.push({ type: 'waveStart', wave: sim.wave, enemies: sim.enemies.map(enemyView) });
}

function killEnemy(sim: Sim, enemy: EnemyRuntime, events: FightEvent[]): void {
  enemy.hp = 0;
  enemy.chargeLandsAt = null;
  const split = traitsOf(enemy, 'split')[0];
  if (!split) return;
  const born: EnemyRuntime[] = [];
  for (let i = 0; i < split.count; i += 1) {
    const child = spawnEnemy(sim, split.into);
    if (child) born.push(child);
  }
  if (born.length === 0) return;
  sim.enemies.push(...born);
  events.push({ type: 'spawn', enemies: born.map(enemyView) });
}

/** Damage after the boss bonus and armor (never below 1). Returns what was dealt and whether it killed. */
export function damageEnemy(sim: Sim, enemy: EnemyRuntime, raw: number, events: FightEvent[]): { damage: number; killed: boolean } {
  const bossFactor = enemy.template.boss ? (100 + sim.meta.bossDamage) / 100 : 1;
  const armor = traitsOf(enemy, 'armor').reduce((sum, t) => sum + t.flat, 0);
  const damage = Math.max(1, Math.floor(raw * bossFactor) - armor);
  enemy.hp = Math.max(0, enemy.hp - damage);
  const killed = enemy.hp === 0;
  if (killed) killEnemy(sim, enemy, events);
  return { damage, killed };
}
