import { TICKS_PER_SECOND, msToTicks, traitsOf } from './enemies';
import { livingEnemies } from './runtime';
import type { EnemyRuntime, Sim } from './runtime';
import type { FightEvent } from './types';

const ATTACK = 1000;

/** Damage of a plain attack: base, grown by the ramp trait for every second since the wave began. */
function hitDamage(sim: Sim, enemy: EnemyRuntime): number {
  const ramp = traitsOf(enemy, 'ramp').reduce((sum, t) => sum + t.percentPerSecond, 0);
  const elapsedSeconds = (sim.tick - sim.waveStartTick) / TICKS_PER_SECOND;
  return Math.floor((enemy.damage * (100 + ramp * elapsedSeconds)) / 100);
}

/** Lands a hit on the player. Returns false when a block ate it. */
function hitPlayer(sim: Sim, enemy: EnemyRuntime, raw: number, charged: boolean, events: FightEvent[]): boolean {
  if (sim.tick < sim.blockUntil) {
    sim.blockUntil = 0;
    events.push({ type: 'enemyHit', source: enemy.uid, damage: 0, blocked: true, charged });
    return false;
  }
  let damage = Math.max(1, Math.floor((raw * 100) / (100 + sim.stats.resiliencia)));
  const saved = sim.hasSecondWind && !sim.secondWindUsed && sim.hp - damage <= 0;
  if (saved) {
    damage = sim.hp - 1;
    sim.secondWindUsed = true;
  }
  sim.hp = Math.max(0, sim.hp - damage);
  events.push({ type: 'enemyHit', source: enemy.uid, damage, blocked: false, charged });
  if (saved) events.push({ type: 'secondWind' });
  return true;
}

function attack(sim: Sim, enemy: EnemyRuntime, events: FightEvent[]): void {
  enemy.attacks += 1;
  if (!hitPlayer(sim, enemy, hitDamage(sim, enemy), false, events)) return;
  const stun = traitsOf(enemy, 'stun')[0];
  if (stun && stun.everyAttacks > 0 && enemy.attacks % stun.everyAttacks === 0 && sim.hp > 0) {
    sim.stunned = true;
    events.push({ type: 'stunned' });
  }
}

/** Returns true when the enemy used its turn on a charge (no plain attack this tick). */
function charge(sim: Sim, enemy: EnemyRuntime, events: FightEvent[]): boolean {
  const trait = traitsOf(enemy, 'charge')[0];
  if (!trait) return false;
  if (enemy.chargeLandsAt !== null) {
    if (sim.tick < enemy.chargeLandsAt) return true;
    enemy.chargeLandsAt = null;
    enemy.nextChargeAt = sim.tick + Math.round(trait.everySeconds * TICKS_PER_SECOND);
    hitPlayer(sim, enemy, Math.floor(enemy.damage * trait.hitMultiplier), true, events);
    return true;
  }
  if (enemy.nextChargeAt !== null && sim.tick >= enemy.nextChargeAt) {
    enemy.chargeLandsAt = sim.tick + msToTicks(trait.windupMs);
    events.push({ type: 'chargeStart', source: enemy.uid, landsAt: enemy.chargeLandsAt });
    return true;
  }
  return false;
}

/** Every living enemy acts, in arena order; one that was just born starts with an empty attack bar. */
export function enemiesAct(sim: Sim, events: FightEvent[]): void {
  for (const enemy of livingEnemies(sim)) {
    if (sim.hp <= 0) return;
    if (charge(sim, enemy, events)) continue;
    enemy.attackProgress += enemy.template.attackSpeed;
    while (enemy.attackProgress >= ATTACK && sim.hp > 0) {
      enemy.attackProgress -= ATTACK;
      attack(sim, enemy, events);
    }
  }
}
