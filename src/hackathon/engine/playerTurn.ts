import { damageEnemy } from './enemies';
import { livingEnemies } from './runtime';
import type { Sim } from './runtime';
import type { FightEvent } from './types';

/** Attack progress is counted in thousandths of a hit; agilidade is hits per second x100, so one tick adds it directly. */
const HIT = 1000;

function effectiveAgility(sim: Sim): number {
  const hasted = sim.tick < sim.hasteUntil;
  return hasted ? Math.floor(sim.stats.agilidade * sim.hasteMultiplier) : sim.stats.agilidade;
}

function splashOnCrit(sim: Sim, hit: number, firstTarget: number, events: FightEvent[]): void {
  for (const chance of sim.critSplashChances) {
    if (sim.splash() * 100 >= chance) continue;
    for (const other of livingEnemies(sim)) {
      if (other.uid === firstTarget) continue;
      const { damage, killed } = damageEnemy(sim, other, hit, events);
      events.push({ type: 'playerHit', target: other.uid, damage, crit: true, flow: false, killed });
    }
  }
}

/** One plain hit on the first living enemy. A stun swallows it. */
function hit(sim: Sim, events: FightEvent[]): void {
  if (sim.stunned) {
    sim.stunned = false;
    return;
  }
  const target = livingEnemies(sim)[0];
  if (!target) return;
  // The crit roll is always drawn, so using Flow never shifts the rolls that follow.
  const roll = sim.crit();
  const flow = sim.flowReady;
  const crit = flow || roll * 100 < sim.stats.atencao;
  sim.flowReady = false;
  const raw = crit ? Math.floor(sim.stats.logica * sim.content.config.critMultiplier) : sim.stats.logica;
  const { damage, killed } = damageEnemy(sim, target, raw, events);
  events.push({ type: 'playerHit', target: target.uid, damage, crit, flow, killed });
  if (crit && sim.critSplashChances.length > 0) splashOnCrit(sim, raw, target.uid, events);
}

/** The student's auto-attack for this tick. */
export function playerAttacks(sim: Sim, events: FightEvent[]): void {
  if (livingEnemies(sim).length === 0) return;
  sim.attackProgress += effectiveAgility(sim);
  while (sim.attackProgress >= HIT && livingEnemies(sim).length > 0) {
    sim.attackProgress -= HIT;
    hit(sim, events);
  }
  sim.attackProgress = Math.min(sim.attackProgress, HIT - 1);
}
