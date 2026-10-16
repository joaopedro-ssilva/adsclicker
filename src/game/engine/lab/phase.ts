import type { GameContent } from '../../content/types';
import type { Emit } from '../../store/types';
import type { GameState } from '../state';
import type { LabTotals } from './effects';
import { noteBestPhase } from './build';
import { labTotals } from './effects';
import { LAB_STREAM, labIndex, labStream } from './state';
import type { LabMob, LabRun } from './types';

export function isBossPhase(content: GameContent, phase: number): boolean {
  return phase % content.lab.run.bossEvery === 0;
}

/** The boss of a boss phase: the cycle in order (phase 5 the first, phase 10 the second...), starting over at the end. */
export function bossFor(content: GameContent, phase: number): string {
  const { bossEvery, bossCycle } = content.lab.run;
  const turn = Math.max(0, Math.floor(phase / bossEvery) - 1);
  return bossCycle[turn % bossCycle.length] ?? bossCycle[0] ?? '';
}

/** HP of the mobs of a phase, as a multiple of their level-1 HP. */
export function hpFactor(content: GameContent, phase: number): number {
  return content.lab.run.hpGrowth ** (Math.max(1, phase) - 1);
}

/** Integrity drained by the mobs of a phase, as a multiple of the level-1 drain. */
export function drainFactor(content: GameContent, phase: number): number {
  return content.lab.run.drainGrowth ** (Math.max(1, phase) - 1);
}

/** The monitor's maximum integrity with what the player owns. */
export function maxIntegrityFor(content: GameContent, totals: LabTotals): number {
  const { startIntegrity, minIntegrity } = content.lab.run;
  const factor = Math.max(0.1, 1 + totals.lab.integrityPct);
  return Math.max(minIntegrity, Math.round((startIntegrity + totals.lab.integrityFlat) * factor));
}

/** Follows a change of the maximum integrity: a rise fills the new room, a fall trims what is above it. */
export function syncIntegrity(run: LabRun, content: GameContent, totals: LabTotals): void {
  const max = maxIntegrityFor(content, totals);
  if (max > run.maxIntegrity) run.integrity += max - run.maxIntegrity;
  run.maxIntegrity = max;
  run.integrity = Math.min(run.integrity, max);
}

/** Share of the damage a mob with the `armor` trait lets through. */
export function armorFactor(content: GameContent, flat: number): number {
  const { armorPerPoint, armorMax } = content.lab.run;
  return 1 - Math.min(armorMax, Math.max(0, flat) * armorPerPoint);
}

export function addMob(run: LabRun, content: GameContent, defId: string, phase: number, boss: boolean): LabMob | null {
  const def = labIndex(content).enemies.get(defId);
  if (!def) return null;
  const { hpScale, bossHpFactor } = content.lab.run;
  const hp = def.hp * hpScale * (boss ? bossHpFactor : 1) * hpFactor(content, phase);
  run.mobSeq += 1;
  const mob: LabMob = { uid: run.mobSeq, def: def.id, hp, maxHp: hp };
  run.waveHp += hp;
  return mob;
}

/**
 * Fills the current phase: a boss every Nth phase, otherwise 2..6 mobs drawn with the phase's stream. The same seed and
 * phase always give the same wave.
 */
export function spawnPhase(state: GameState, content: GameContent, totals: LabTotals): void {
  const run = state.lab.turma.run;
  if (!run) return;
  const cfg = content.lab.run;
  const index = labIndex(content);
  const phase = run.phase;
  const stream = labStream(run.seed, LAB_STREAM.wave, phase);

  run.mobs = [];
  run.waveHp = 0;
  run.phaseTime = 0;
  run.windUsed = 0;
  run.nextCharge = 0;
  run.bossLeft = null;

  if (isBossPhase(content, phase)) {
    const bossId = bossFor(content, phase);
    const boss = addMob(run, content, bossId, phase, true);
    if (boss) {
      run.mobs.push(boss);
      run.bossLeft = cfg.bossTimerSeconds + totals.lab.bossTime;
      const charge = index.enemies.get(bossId)?.traits.find((trait) => trait.kind === 'charge');
      if (charge?.kind === 'charge') run.nextCharge = charge.everySeconds;
    }
  }

  if (run.mobs.length === 0) {
    const pool = content.lab.enemies.filter((enemy) => !enemy.boss && (cfg.enemyFrom[enemy.id] ?? Infinity) <= phase);
    const size = Math.min(cfg.waveMax, cfg.waveMin + Math.floor((phase - 1) / cfg.waveGrowEvery) + (stream() < 0.5 ? 0 : 1));
    for (let i = 0; i < size && pool.length > 0; i += 1) {
      const enemy = pool[Math.floor(stream() * pool.length)];
      const mob = enemy ? addMob(run, content, enemy.id, phase, false) : null;
      if (mob) run.mobs.push(mob);
    }
  }
  run.status = 'fighting';
}

/** Moves on to the next phase (after a reward was taken and settled). */
export function enterNextPhase(state: GameState, content: GameContent): void {
  const { lab } = state;
  const run = lab.turma.run;
  if (!run) return;
  run.phase += 1;
  noteBestPhase(lab, run.phase);
  run.offers = [];
  const totals = labTotals(state, content);
  syncIntegrity(run, content, totals);
  spawnPhase(state, content, totals);
}

/** Adds Commits to the wallet and to the lifetime counter. */
export function gainCommits(state: GameState, amount: number): void {
  const whole = Math.max(0, Math.floor(amount));
  state.lab.commits += whole;
  state.lab.counters.commitsEarned += whole;
}

/** Commits a run pays when it ends: so much per phase cleared and per boss beaten, plus the tree's and items' bonus. */
export function runCommits(content: GameContent, run: LabRun, totals: LabTotals): number {
  const { perPhase, perBoss } = content.lab.commits;
  return Math.floor((run.cleared * perPhase + run.bosses * perBoss) * (1 + Math.max(0, totals.lab.commits)));
}

/** The monitor breaks: the run is over for this turma and the Commits are paid. */
export function breakRun(state: GameState, content: GameContent, reason: 'timer' | 'integrity', emit: Emit): void {
  const { lab } = state;
  const run = lab.turma.run;
  if (!run || run.status === 'broken') return;
  const paid = runCommits(content, run, labTotals(state, content));
  run.status = 'broken';
  run.brokenBy = reason;
  run.integrity = Math.max(0, run.integrity);
  run.bossLeft = run.bossLeft === null ? null : Math.max(0, run.bossLeft);
  run.paid = paid;
  run.carry = 0;
  gainCommits(state, paid);
  lab.counters.broken += 1;
  noteBestPhase(lab, run.phase, true);
  emit({ type: 'labBroken', phase: run.phase, reason, commits: paid });
}
