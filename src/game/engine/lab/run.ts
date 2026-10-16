import type { Stream } from '../../../hackathon/engine/rng';
import type { LabEnemyDef, LabItemBase, LabRarity } from '../../content/labTypes';
import type { GameContent } from '../../content/types';
import type { Emit } from '../../store/types';
import type { GameState } from '../state';
import { labRunAvailable } from './access';
import { noteBestPhase } from './build';
import { labStarterId } from './cosmetics';
import { labTotals } from './effects';
import type { LabTotals } from './effects';
import { rollItem } from './items';
import { addMob, armorFactor, bossFor, breakRun, drainFactor, gainCommits, maxIntegrityFor, runCommits, spawnPhase } from './phase';
import { makeOffers } from './rewards';
import { LAB_STREAM, createLabRun, droppableAt, labIndex, labStream } from './state';
import type { LabItem, LabRun } from './types';

const round1 = (value: number) => Math.round(value * 10) / 10;
/** Longest clear log kept (phases). */
const MAX_CLEAR_LOG = 2000;

/** Automatic damage per second: the power of the equipped items x (1 + damage bonuses), bosses taking the boss bonus too. */
export function autoDps(totals: LabTotals, boss: boolean): number {
  const bonus = totals.lab.damage + (boss ? totals.lab.bossDamage : 0);
  return totals.power * Math.max(0.1, 1 + bonus);
}

/** Damage one click deals: a small share of the automatic damage per second. */
export function clickDamage(content: GameContent, totals: LabTotals, boss: boolean): number {
  return autoDps(totals, boss) * content.lab.run.click.share * (1 + Math.max(0, totals.lab.clickDamage));
}

/** Most extra damage per second the clicks can add, as a share of the automatic damage (clicks per second x share). */
export function clickShareCap(content: GameContent): number {
  const { click } = content.lab.run;
  return (click.perWindow * 1000) / click.windowMs * click.share;
}

/** Hits the first mobs for `amount` raw damage, armour included. A mob that dies with the split trait leaves its pieces. */
function dealDamage(run: LabRun, content: GameContent, amount: number): void {
  const index = labIndex(content);
  let left = amount;
  while (left > 0 && run.mobs.length > 0) {
    const mob = run.mobs[0];
    if (!mob) break;
    const def = index.enemies.get(mob.def);
    const armor = armorFactor(content, armorFlat(def));
    const effective = left * armor;
    if (effective < mob.hp) {
      mob.hp -= effective;
      return;
    }
    left -= mob.hp / armor;
    run.mobs.shift();
    const split = def?.traits.find((trait) => trait.kind === 'split');
    if (split?.kind === 'split') {
      const kids = [];
      for (let i = 0; i < split.count; i += 1) {
        const kid = addMob(run, content, split.into, run.phase, false);
        if (kid) kids.push(kid);
      }
      run.mobs.unshift(...kids);
    }
  }
}

function armorFlat(def: LabEnemyDef | undefined): number {
  const trait = def?.traits.find((entry) => entry.kind === 'armor');
  return trait?.kind === 'armor' ? trait.flat : 0;
}

/** Integrity the living mobs drain per second, ramps and the player's reductions included. */
export function drainPerSecond(run: LabRun, content: GameContent, totals: LabTotals): number {
  const index = labIndex(content);
  const { drainScale, minDrainMult } = content.lab.run;
  const base = drainScale * drainFactor(content, run.phase);
  let total = 0;
  for (const mob of run.mobs) {
    const def = index.enemies.get(mob.def);
    if (!def) continue;
    const ramp = def.traits.find((trait) => trait.kind === 'ramp');
    const rampFactor = ramp?.kind === 'ramp' ? 1 + (ramp.percentPerSecond / 100) * run.phaseTime : 1;
    total += def.damage * (def.attackSpeed / 100) * rampFactor;
  }
  return total * base * Math.max(minDrainMult, 1 + totals.lab.drain);
}

/** Integrity lost: the shield of the phase (tree) takes it first. */
function drainIntegrity(run: LabRun, amount: number): void {
  const absorbed = Math.min(run.shield, amount);
  run.shield -= absorbed;
  run.integrity -= amount - absorbed;
}

/** The phase is cleared: repairs, counters, and the options of the reward. */
function phaseCleared(state: GameState, content: GameContent, totals: LabTotals, emit: Emit): void {
  const { lab } = state;
  const run = lab.turma.run;
  if (!run) return;
  const boss = run.bossLeft !== null;
  run.cleared += 1;
  lab.counters.phasesCleared += 1;
  if (run.clearLog.length < MAX_CLEAR_LOG) run.clearLog.push(round1(run.t));

  const fast = !boss && run.phaseTime < content.lab.run.fastClearSeconds;
  const share = totals.lab.repairPhase + (boss ? totals.lab.repairBoss : 0) + (fast ? totals.lab.fastClearRepair : 0);
  if (share > 0) run.integrity = Math.min(run.maxIntegrity, run.integrity + run.maxIntegrity * share);
  if (boss) {
    run.bosses += 1;
    lab.counters.bossesBeaten += 1;
    gainCommits(state, totals.lab.bossCommits * (1 + Math.max(0, totals.lab.commits)));
  }
  run.bossLeft = null;
  run.nextCharge = 0;
  run.mobs = [];
  run.rerolled = 0;
  run.offers = makeOffers(state, content, totals);
  run.status = 'reward';
  emit({ type: 'labPhaseCleared', phase: run.phase, boss });
  if (boss) emit({ type: 'labBossBeaten', phase: run.phase });
}

/** One fixed step of the fight: damage, then the cleared check, then the drain, the boss's charge and its timer. */
function stepRun(state: GameState, content: GameContent, totals: LabTotals, dt: number, emit: Emit): void {
  const run = state.lab.turma.run;
  if (!run) return;
  run.t += dt;
  run.phaseTime += dt;
  const boss = run.bossLeft !== null;

  dealDamage(run, content, autoDps(totals, boss) * dt);
  if (run.mobs.length === 0) {
    phaseCleared(state, content, totals, emit);
    return;
  }

  drainIntegrity(run, drainPerSecond(run, content, totals) * dt);

  if (boss && run.nextCharge > 0 && run.phaseTime >= run.nextCharge) {
    const { drainScale, minDrainMult } = content.lab.run;
    const def = labIndex(content).enemies.get(bossFor(content, run.phase));
    const charge = def?.traits.find((trait) => trait.kind === 'charge');
    if (def && charge?.kind === 'charge') {
      const hit = def.damage * charge.hitMultiplier * drainScale * drainFactor(content, run.phase);
      drainIntegrity(run, hit * Math.max(minDrainMult, 1 + totals.lab.drain));
      run.nextCharge += charge.everySeconds;
    } else {
      run.nextCharge = 0;
    }
  }

  if (run.integrity <= 0) {
    if (run.windUsed < totals.lab.secondWind) {
      run.windUsed += 1;
      run.integrity = run.maxIntegrity * content.lab.run.secondWindShare;
    } else {
      breakRun(state, content, 'integrity', emit);
      return;
    }
  }

  if (run.bossLeft !== null) {
    run.bossLeft -= dt;
    if (run.bossLeft <= 1e-9) breakRun(state, content, 'timer', emit);
  }
}

/**
 * Feeds `seconds` of real time to the run. It moves only while the lab is open and a phase is being fought; time is
 * cut into fixed steps, so the result does not depend on how often the tick calls.
 */
export function advanceLab(state: GameState, content: GameContent, seconds: number, emit: Emit): void {
  const { lab } = state;
  const run = lab.turma.run;
  if (!lab.unlocked || !lab.open || !run || run.status !== 'fighting' || !(seconds > 0)) return;
  const { stepSeconds, maxAdvanceSeconds } = content.lab.run;
  run.carry += Math.min(seconds, maxAdvanceSeconds);
  const totals = labTotals(state, content);
  let guard = 0;
  while (run.carry + 1e-9 >= stepSeconds && run.status === 'fighting' && guard < 10_000) {
    run.carry -= stepSeconds;
    guard += 1;
    stepRun(state, content, totals, stepSeconds, emit);
  }
  // Round off the float dust of the subtractions, so the same play always leaves the same state.
  run.carry = run.status === 'fighting' ? Math.max(0, Math.round(run.carry * 1e9) / 1e9) : 0;
}

/**
 * A click on the monitor: a small share of the automatic damage, and at most `perWindow` clicks count in any
 * `windowMs` (so clicks add at most share x perWindow of the automatic damage per second). False when the click did not
 * count (nothing to hit, or past the limit).
 */
export function labClick(state: GameState, content: GameContent, now: number, emit: Emit): boolean {
  const { lab } = state;
  const run = lab.turma.run;
  if (!lab.unlocked || !lab.open || !run || run.status !== 'fighting') return false;
  const { perWindow, windowMs } = content.lab.run.click;
  const from = now - windowMs;
  run.clickTimes = run.clickTimes.filter((at) => at > from && at <= now);
  if (run.clickTimes.length >= perWindow) return false;
  run.clickTimes.push(now);

  const totals = labTotals(state, content);
  lab.counters.clicks += 1;
  dealDamage(run, content, clickDamage(content, totals, run.bossLeft !== null));
  if (run.mobs.length === 0) phaseCleared(state, content, totals, emit);
  return true;
}

/** Opens or closes the lab screen: the run is paused while it is closed. */
export function setLabOpen(state: GameState, open: boolean): void {
  if (state.lab.open === open) return;
  state.lab.open = open && state.lab.unlocked;
  if (!state.lab.open && state.lab.turma.run) state.lab.turma.run.carry = 0;
}

/** Gives a new item (level 1) to its slot at the start of a run, if the slot is empty. */
function giveStarter(state: GameState, content: GameContent, base: LabItemBase | undefined, stream: Stream, rarity: LabRarity = 'comum'): void {
  if (!base || state.lab.turma.equipped[base.slot]) return;
  const item: LabItem = rollItem(content, base, rarity, 1, stream);
  item.uid = state.lab.turma.nextUid;
  state.lab.turma.nextUid += 1;
  state.lab.turma.equipped[base.slot] = item;
}

/**
 * Starts the run of this turma: only when the lab is unlocked, every aula is at level 1 or more, and no run was
 * made yet (a broken monitor ends the lab for the turma). The Mouse quebrado goes in the ferramenta slot, and the tree
 * may add a comum item in the Setup slot. `seed` (32 bits) decides every roll of the run.
 */
export function startLabRun(state: GameState, content: GameContent, seed: number, emit: Emit): boolean {
  const { lab } = state;
  if (!labRunAvailable(state, content).ok || lab.turma.run) return false;

  const run = createLabRun(seed, content.lab.run.startIntegrity);
  lab.turma.run = run;
  const index = labIndex(content);
  // The equipped starting item (a shop cosmetic) replaces the Mouse quebrado: same power, a small effect of its own.
  giveStarter(state, content, index.bases.get(labStarterId(state, content)), labStream(run.seed, LAB_STREAM.starter, 0));
  const owned = labTotals(state, content);
  if (owned.lab.startSetup > 0) {
    const setups = droppableAt(content, 1).filter((base) => base.slot === 'setup');
    const stream = labStream(run.seed, LAB_STREAM.starter, 1);
    giveStarter(state, content, setups[Math.floor(stream() * setups.length)], stream);
  }
  // The tree's gifts: random incomum items in the slots still empty (one more slot per level).
  for (let gift = 0; gift < Math.floor(owned.lab.startItem); gift += 1) {
    const stream = labStream(run.seed, LAB_STREAM.starter, 10 + gift);
    const bases = droppableAt(content, 1).filter((base) => !lab.turma.equipped[base.slot]);
    giveStarter(state, content, bases[Math.floor(stream() * bases.length)], stream, 'incomum');
  }

  const totals = labTotals(state, content);
  run.maxIntegrity = maxIntegrityFor(content, totals);
  run.integrity = run.maxIntegrity;
  lab.counters.runs += 1;
  noteBestPhase(lab, 1);
  lab.open = true;
  spawnPhase(state, content, totals);
  emit({ type: 'labRunStarted', seed: run.seed });
  return true;
}

/**
 * What a graduation does to the lab: a run still going is paid like a break (the player keeps the Commits of the
 * phases cleared), then the run, the equipped items and the run buffs are wiped. The unlock, Commits, the tree and
 * the records stay.
 */
export function resetLabForGraduation(state: GameState, content: GameContent): void {
  const { lab } = state;
  const run = lab.turma.run;
  if (run && run.status !== 'broken') gainCommits(state, runCommits(content, run, labTotals(state, content)));
  // A run that is still on its record phase files the build it ends with, before the items go.
  if (run) noteBestPhase(lab, run.phase, true);
  lab.turma = { run: null, equipped: {}, nextUid: 1 };
  lab.open = false;
}
