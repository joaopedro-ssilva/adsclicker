import type { GameContent, MaestriasConfig } from '../../content/types';
import type { Emit } from '../../store/types';
import { Decimal, ZERO } from '../decimal';
import { clickValueWith, gain } from '../economy';
import type { GameState } from '../state';
import { computeStats } from '../stats';
import { atLevel, steadyCoinsPerSecond } from './production';
import { maestriaLevel } from './slots';
import type { ActiveSwarm, SwarmBug } from './types';

const MINUTE_MS = 60_000;
/** Keeps bugs off the very edge of the stage. */
const STAGE_MARGIN = 0.08;
/** The floor of a reward is rewardClickFloor click values for this many seconds of reward (as in invasions). */
const FLOOR_REFERENCE_SECONDS = 150;
/** The firewall hits the boss this many times less often than a bug. */
const FIREWALL_BOSS_SLOWDOWN = 2;

const swarmConfig = (content: GameContent): MaestriasConfig['swarm'] => content.maestrias.swarm;

/** Real time one charge takes to fill at the current level, in ms. 0 when the Maestria is not unlocked. */
export function swarmChargeMs(state: GameState, content: GameContent): number {
  const level = maestriaLevel(state, 'wagner');
  return level > 0 ? atLevel(swarmConfig(content).chargeMinutes, level) * MINUTE_MS : 0;
}

/** 0..1 of the charge; 1 = ready. A Maestria that is not unlocked is 0. */
export function swarmCharge(state: GameState, content: GameContent, now: number): number {
  const needed = swarmChargeMs(state, content);
  const { since } = state.maestria.swarm;
  if (needed <= 0 || since <= 0) return 0;
  return Math.min(1, Math.max(0, (now - since) / needed));
}

export function swarmReady(state: GameState, content: GameContent, now: number): boolean {
  return state.maestria.swarm.active === null && swarmCharge(state, content, now) >= 1;
}

/** Most seconds of the class's production one swarm can pay (every bug, the boss, the clear bonus, before event bonuses). */
export function swarmMaxSeconds(content: GameContent, level: number): number {
  const cfg = swarmConfig(content);
  return (cfg.bugs * cfg.bugSeconds + cfg.bossSeconds) * cfg.clearBonus * atLevel(cfg.rewardMult, level);
}

export function swarmSeconds(
  content: GameContent,
  level: number,
  defeated: number,
  bossDefeated: boolean,
  cleared: boolean,
): number {
  const cfg = swarmConfig(content);
  const base = defeated * cfg.bugSeconds + (bossDefeated ? cfg.bossSeconds : 0);
  return base * (cleared ? cfg.clearBonus : 1) * atLevel(cfg.rewardMult, level);
}

/** Starts the Super invasão when it is charged. The charge starts filling again at once. */
export function startSwarm(state: GameState, content: GameContent, now: number, emit: Emit): boolean {
  const level = maestriaLevel(state, 'wagner');
  if (level <= 0 || !swarmReady(state, content, now)) return false;

  const cfg = swarmConfig(content);
  const swarm = state.maestria.swarm;
  swarm.seq += 1;
  swarm.since = now;
  const every = atLevel(cfg.firewallEveryMs, level);
  swarm.active = {
    uid: swarm.seq,
    startedAt: now,
    endsAt: now + cfg.durationMs,
    bugs: [],
    spawned: 0,
    defeated: 0,
    escaped: 0,
    bossSpawned: false,
    bossDefeated: false,
    nextAutoAt: every > 0 ? now + every : 0,
    bugSeq: 0,
  };

  // The invasion on stage waits for the swarm, and no new one comes while it lasts.
  if (state.invasion) state.invasion.expiresAt += cfg.durationMs;
  else if (state.nextInvasionAt > 0) state.nextInvasionAt = Math.max(state.nextInvasionAt, now + cfg.durationMs + 3_000);

  emit({ type: 'swarmStart', uid: swarm.seq });
  return true;
}

function randomPosition(rng: () => number): { x: number; y: number } {
  return { x: STAGE_MARGIN + rng() * (1 - 2 * STAGE_MARGIN), y: STAGE_MARGIN + rng() * (1 - 2 * STAGE_MARGIN) };
}

function pickKind(cfg: MaestriasConfig['swarm'], rng: () => number) {
  const total = cfg.kinds.reduce((sum, kind) => sum + kind.weight, 0);
  let roll = rng() * total;
  for (const kind of cfg.kinds) {
    roll -= kind.weight;
    if (roll < 0) return kind;
  }
  return cfg.kinds[cfg.kinds.length - 1];
}

function spawnDue(swarm: ActiveSwarm, cfg: MaestriasConfig['swarm'], now: number, rng: () => number): void {
  while (swarm.spawned < cfg.bugs) {
    const at = swarm.startedAt + cfg.firstSpawnMs + swarm.spawned * cfg.spawnEveryMs;
    if (at > now) break;
    swarm.spawned += 1;
    const kind = pickKind(cfg, rng);
    if (!kind) continue;
    if (at + cfg.bugLifeMs <= now) {
      swarm.escaped += 1; // it came and went while nobody was looking
      continue;
    }
    swarm.bugSeq += 1;
    swarm.bugs.push({
      uid: swarm.bugSeq,
      kind: kind.id,
      boss: false,
      hp: kind.hp,
      maxHp: kind.hp,
      ...randomPosition(rng),
      expiresAt: at + cfg.bugLifeMs,
    });
  }
  if (!swarm.bossSpawned && now >= swarm.startedAt + cfg.bossAtMs) {
    swarm.bossSpawned = true;
    swarm.bugSeq += 1;
    swarm.bugs.push({
      uid: swarm.bugSeq,
      kind: cfg.boss.id,
      boss: true,
      hp: cfg.boss.hp,
      maxHp: cfg.boss.hp,
      x: 0.5,
      y: 0.42,
      expiresAt: swarm.endsAt,
    });
  }
}

/** One point of damage; removes the bug when it falls. Returns true when it died. */
function damage(swarm: ActiveSwarm, bug: SwarmBug, emit: Emit, auto: boolean): boolean {
  bug.hp -= 1;
  const killed = bug.hp <= 0;
  if (killed) {
    swarm.bugs = swarm.bugs.filter((entry) => entry.uid !== bug.uid);
    if (bug.boss) swarm.bossDefeated = true;
    else swarm.defeated += 1;
  }
  emit({ type: 'swarmHit', uid: swarm.uid, bug: bug.uid, x: bug.x, y: bug.y, hp: Math.max(0, bug.hp), boss: bug.boss, killed, auto });
  return killed;
}

function finished(swarm: ActiveSwarm, cfg: MaestriasConfig['swarm'], now: number): boolean {
  if (now >= swarm.endsAt) return true;
  return swarm.spawned >= cfg.bugs && swarm.bossSpawned && swarm.bugs.length === 0;
}

function settle(state: GameState, content: GameContent, swarm: ActiveSwarm, emit: Emit): void {
  const cfg = swarmConfig(content);
  const level = maestriaLevel(state, 'wagner');
  const cleared = swarm.defeated >= cfg.bugs && swarm.bossDefeated;
  const seconds = swarmSeconds(content, level, swarm.defeated, swarm.bossDefeated, cleared);

  const stats = computeStats(state, content);
  let coins: Decimal = ZERO;
  if (seconds > 0) {
    const fromProduction = steadyCoinsPerSecond(state, content).mul(seconds);
    const floor = clickValueWith(state, content, stats).mul((content.balance.rewardClickFloor * seconds) / FLOOR_REFERENCE_SECONDS);
    coins = Decimal.max(fromProduction, floor).mul(stats.eventReward);
    gain(state, coins, 'events');
  }
  state.maestria.swarm.active = null;
  if (swarm.bossDefeated) state.counters.swarmsWon += 1;
  if (cleared) state.counters.swarmsCleared += 1;
  emit({
    type: 'swarmEnd',
    uid: swarm.uid,
    defeated: swarm.defeated,
    total: cfg.bugs,
    bossDefeated: swarm.bossDefeated,
    cleared,
    seconds,
    coins,
  });
}

/** A click on a bug. The boss and the bugs lose one point of health per click. */
export function hitSwarmBug(state: GameState, content: GameContent, uid: number, now: number, emit: Emit): boolean {
  const swarm = state.maestria.swarm.active;
  if (!swarm || now >= swarm.endsAt) return false;
  const bug = swarm.bugs.find((entry) => entry.uid === uid);
  if (!bug || (!bug.boss && now >= bug.expiresAt)) return false;
  damage(swarm, bug, emit, false);
  if (finished(swarm, swarmConfig(content), now)) settle(state, content, swarm, emit);
  return true;
}

/** Spawns, firewalls, expires and ends the swarm in progress. Also starts the charge of a fresh Maestria. */
export function updateSwarm(state: GameState, content: GameContent, now: number, rng: () => number, emit: Emit): void {
  const level = maestriaLevel(state, 'wagner');
  const swarmState = state.maestria.swarm;
  if (level > 0 && swarmState.since <= 0) swarmState.since = now;

  const swarm = swarmState.active;
  if (!swarm) return;
  const cfg = swarmConfig(content);

  spawnDue(swarm, cfg, now, rng);

  const every = atLevel(cfg.firewallEveryMs, level);
  if (every > 0 && swarm.nextAutoAt > 0) {
    // Bounded by the ticks that fit in the swarm, so a long sleep cannot loop for long.
    let guard = Math.ceil(cfg.durationMs / every) + 1;
    while (swarm.nextAutoAt <= Math.min(now, swarm.endsAt) && guard > 0) {
      guard -= 1;
      const target = swarm.bugs.filter((bug) => !bug.boss && bug.expiresAt > swarm.nextAutoAt)[0] ?? swarm.bugs.find((bug) => bug.boss);
      const step = target?.boss ? every * FIREWALL_BOSS_SLOWDOWN : every;
      if (target) damage(swarm, target, emit, true);
      swarm.nextAutoAt += step;
    }
  }

  const gone = swarm.bugs.filter((bug) => !bug.boss && bug.expiresAt <= now);
  if (gone.length > 0) {
    swarm.escaped += gone.length;
    swarm.bugs = swarm.bugs.filter((bug) => bug.boss || bug.expiresAt > now);
    for (const bug of gone) emit({ type: 'swarmEscape', uid: swarm.uid, bug: bug.uid, x: bug.x, y: bug.y });
  }

  if (finished(swarm, cfg, now)) settle(state, content, swarm, emit);
}
