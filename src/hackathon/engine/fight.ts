import type { HackathonContent, Modifier } from '../content/types';
import { shouldUseSkill } from './autoPolicy';
import type { PolicyView } from './autoPolicy';
import { enemiesAct } from './enemyTurn';
import { msToTicks, startWave } from './enemies';
import { playerAttacks } from './playerTurn';
import { indexOf } from './contentIndex';
import { resolveMeta, resolveStats, totalsOf } from './modifiers';
import { SALT, createStream, shuffled } from './rng';
import { livingEnemies, registerSim, simOf, toState } from './runtime';
import type { Sim } from './runtime';
import { healAmount, healPlayer, skillPowerFactor, castSkill } from './skills';
import type { FightEvent, Run, RunAction, RunSetup } from './types';

const OFFER_SIZE = 3;
/** Cap used when the config has no usable run expiry. */
const FALLBACK_MAX_TICKS = 18000;

/** Wave order: every wave but the last is shuffled by the seed; the last stays last. */
function waveOrder(setup: RunSetup, content: HackathonContent): string[][] {
  const known = indexOf(content).enemies;
  const waves = setup.stage.waves.map((wave) => wave.filter((id) => known.has(id))).filter((wave) => wave.length > 0);
  const last = waves.pop();
  const order = shuffled(createStream(setup.seed, SALT.waves), waves);
  if (last) order.push(last);
  return order;
}

/**
 * One offer per wave except the last: the buff pool shuffled once by the seed and dealt three at a
 * time, so offers never repeat a buff (while the pool lasts) and never depend on earlier picks.
 */
function dealOffers(setup: RunSetup, waveCount: number, content: HackathonContent): Sim['offers'] {
  const pool = shuffled(createStream(setup.seed, SALT.offers), content.waveBuffs.map((b) => b.id));
  const offers: Sim['offers'] = [];
  for (let wave = 0; wave < waveCount - 1; wave += 1) {
    const pick = (slot: number): string | undefined => pool[(wave * OFFER_SIZE + slot) % pool.length];
    const [a, b, c] = [pick(0), pick(1), pick(2)];
    offers.push(a !== undefined && b !== undefined && c !== undefined ? [a, b, c] : null);
  }
  return offers;
}

export function createRun(setup: RunSetup, content: HackathonContent): Run {
  const index = indexOf(content);
  const waves = waveOrder(setup, content);
  const modifiers = setup.stage.modifiers;
  const sum = (pick: (m: (typeof modifiers)[number]) => number | undefined): number =>
    modifiers.reduce((total, m) => total + (pick(m) ?? 0), 0);
  const { build } = setup;
  const maxTicks = (content.config.runExpiryMinutes > 0 ? content.config.runExpiryMinutes * 600 : FALLBACK_MAX_TICKS);
  const sim: Sim = {
    content,
    index,
    setup,
    waves,
    offers: dealOffers(setup, waves.length, content),
    crit: createStream(setup.seed, SALT.crit),
    splash: createStream(setup.seed, SALT.splash),
    maxTicks,
    noHealing: modifiers.some((m) => m.noHealing === true),
    enemyHpPercent: sum((m) => m.enemyHpPercent),
    enemyDamagePercent: sum((m) => m.enemyDamagePercent),
    critSplashChances: build.uniques.flatMap((u) => (u.kind === 'critSplash' ? [u.chance] : [])),
    hasSecondWind: build.uniques.some((u) => u.kind === 'secondWind'),
    stats: { ...build.stats },
    meta: { ...build.meta },
    tick: 0,
    phase: waves.length > 0 ? 'fighting' : 'won',
    wave: 0,
    hp: build.stats.foco,
    maxHp: build.stats.foco,
    flowReady: false,
    flowAvailableAt: 0,
    blockUntil: 0,
    hasteUntil: 0,
    hasteMultiplier: 1,
    stunned: false,
    attackProgress: 0,
    skills: [...new Set(build.skills)].filter((id) => index.skills.has(id)).map((id) => ({ id, readyAt: 0 })),
    enemies: [],
    nextUid: 1,
    offer: null,
    buffs: [],
    waveTicksLeft: null,
    waveStartTick: 0,
    secondWindUsed: false,
    wavesCleared: 0,
    pending: [],
  };
  if (waves.length > 0) startWave(sim, sim.pending);
  else sim.pending.push({ type: 'end', won: true, reason: 'cleared' });
  const run: Run = { setup, state: toState(sim) };
  registerSim(run, sim);
  return run;
}

// ---------------------------------------------------------------------------
// Player actions
// ---------------------------------------------------------------------------

/** Buffs change the effective stats; extra max HP also heals by the same amount. */
function applyBuffModifiers(sim: Sim, modifiers: Modifier[]): void {
  const totals = totalsOf(modifiers);
  sim.stats = resolveStats(sim.stats, totals);
  sim.meta = resolveMeta(sim.meta, totals);
  const delta = sim.stats.foco - sim.maxHp;
  sim.maxHp += delta;
  sim.hp = Math.min(sim.maxHp, sim.hp + Math.max(0, delta));
}

function pickBuff(sim: Sim, option: number, events: FightEvent[]): void {
  const id = sim.offer?.[option];
  const buff = id === undefined ? undefined : sim.index.buffs.get(id);
  if (!buff || id === undefined) return;
  applyBuffModifiers(sim, buff.modifiers);
  if (buff.heal) healPlayer(sim, healAmount(sim.maxHp, buff.heal.percentOfMaxHp, 1), events);
  sim.buffs.push(id);
  sim.offer = null;
  events.push({ type: 'buffPicked', buff: id });
  sim.wave += 1;
  sim.phase = 'fighting';
  startWave(sim, events);
}

export function isValidChoice(action: RunAction, tick: number): boolean {
  return action.kind === 'choice' && action.tick === tick && [0, 1, 2].includes(action.option);
}

function applyAction(sim: Sim, action: RunAction, events: FightEvent[]): void {
  if (action.kind === 'flow') {
    if (sim.flowReady || sim.tick < sim.flowAvailableAt) return;
    sim.flowReady = true;
    sim.flowAvailableAt = sim.tick + msToTicks(sim.content.config.flow.minIntervalMs);
  } else if (action.kind === 'skill') {
    if (sim.setup.auto) return;
    const skill = sim.skills.find((s) => s.id === action.skill);
    if (skill && sim.tick >= skill.readyAt) castSkill(sim, skill, false, events);
  }
}

function policyView(sim: Sim): PolicyView {
  return {
    tick: sim.tick,
    hp: sim.hp,
    maxHp: sim.maxHp,
    blockUp: sim.tick < sim.blockUntil,
    hasteUp: sim.tick < sim.hasteUntil,
    noHealing: sim.noHealing,
    power: skillPowerFactor(sim.meta, true, sim.content),
    hit: sim.stats.logica,
    enemies: livingEnemies(sim).map((e) => ({ hp: e.hp, boss: e.template.boss, chargeLandsAt: e.chargeLandsAt })),
  };
}

function autoSkills(sim: Sim, events: FightEvent[]): void {
  for (const skill of sim.skills) {
    if (sim.tick < skill.readyAt) continue;
    const def = sim.index.skills.get(skill.id);
    if (def && shouldUseSkill(def, policyView(sim))) castSkill(sim, skill, true, events);
  }
}

// ---------------------------------------------------------------------------
// The step
// ---------------------------------------------------------------------------

function finish(sim: Sim, won: boolean, reason: 'cleared' | 'defeated' | 'timeout', events: FightEvent[]): void {
  sim.phase = won ? 'won' : 'lost';
  events.push({ type: 'end', won, reason });
}

function closeWave(sim: Sim, events: FightEvent[]): void {
  sim.wavesCleared += 1;
  events.push({ type: 'waveCleared', wave: sim.wave });
  sim.waveTicksLeft = null;
  if (sim.wave >= sim.waves.length - 1) return finish(sim, true, 'cleared', events);
  const offer = sim.offers[sim.wave] ?? null;
  if (offer) {
    sim.phase = 'choosing';
    sim.offer = offer;
    events.push({ type: 'offer', options: offer });
    return;
  }
  sim.wave += 1;
  startWave(sim, events);
}

function checkEnd(sim: Sim, events: FightEvent[]): void {
  if (sim.hp <= 0) return finish(sim, false, 'defeated', events);
  if (livingEnemies(sim).length === 0) return closeWave(sim, events);
  if (sim.waveTicksLeft !== null) {
    sim.waveTicksLeft -= 1;
    if (sim.waveTicksLeft <= 0) finish(sim, false, 'timeout', events);
  }
}

/**
 * One tick. Order: the choice (if choosing), the player's actions, auto skills, the student's
 * attack, the enemies' turn, then the end checks. Only actions stamped with the current tick count.
 */
export function stepRun(run: Run, actions: RunAction[]): FightEvent[] {
  const sim = simOf(run);
  const events = sim.pending.splice(0);
  if (sim.phase === 'won' || sim.phase === 'lost') return events;
  const mine = actions.filter((a) => a.tick === sim.tick);

  if (sim.phase === 'choosing') {
    const choice = mine.find((a) => isValidChoice(a, sim.tick));
    if (!choice || choice.kind !== 'choice') {
      run.state = toState(sim);
      return events;
    }
    pickBuff(sim, choice.option, events);
  }

  for (const action of mine) applyAction(sim, action, events);
  if (sim.setup.auto) autoSkills(sim, events);
  playerAttacks(sim, events);
  if (livingEnemies(sim).length > 0) enemiesAct(sim, events);
  checkEnd(sim, events);
  sim.tick += 1;
  if (sim.phase === 'fighting' && sim.tick >= sim.maxTicks) finish(sim, false, 'timeout', events);
  run.state = toState(sim);
  return events;
}
