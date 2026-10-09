import { MAESTRIA_MAX_LEVEL, PROFESSOR_IDS } from '../../content/types';
import type { GameContent } from '../../content/types';
import { ZERO, parseDecimal } from '../decimal';
import { createMaestriaState } from './slots';
import type { ActiveSwarm, BolsaAssetState, BolsaHolding, BolsaState, HorasState, MaestriaState, SwarmBug } from './types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function num(value: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

const whole = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number => Math.floor(num(value, min, min, max));

function readBugs(value: unknown, content: GameContent): SwarmBug[] {
  const cfg = content.maestrias.swarm;
  const bugs: SwarmBug[] = [];
  if (!Array.isArray(value)) return bugs;
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.expiresAt !== 'number' || !Number.isFinite(entry.expiresAt)) continue;
    const boss = entry.boss === true;
    const kind = boss ? (entry.kind === cfg.boss.id ? cfg.boss : undefined) : cfg.kinds.find((k) => k.id === entry.kind);
    if (!kind) continue;
    bugs.push({
      uid: whole(entry.uid),
      kind: kind.id,
      boss,
      hp: whole(entry.hp, 1, kind.hp),
      maxHp: kind.hp,
      x: num(entry.x, 0.5, 0, 1),
      y: num(entry.y, 0.5, 0, 1),
      expiresAt: entry.expiresAt,
    });
  }
  return bugs;
}

function readSwarm(value: unknown, content: GameContent): ActiveSwarm | null {
  if (!isRecord(value) || typeof value.endsAt !== 'number' || !Number.isFinite(value.endsAt)) return null;
  const bugs = readBugs(value.bugs, content);
  const cfg = content.maestrias.swarm;
  return {
    uid: whole(value.uid),
    startedAt: num(value.startedAt, value.endsAt),
    endsAt: value.endsAt,
    bugs,
    spawned: whole(value.spawned, 0, cfg.bugs),
    defeated: whole(value.defeated, 0, cfg.bugs),
    escaped: whole(value.escaped, 0, cfg.bugs),
    bossSpawned: value.bossSpawned === true,
    bossDefeated: value.bossDefeated === true,
    nextAutoAt: num(value.nextAutoAt, 0, 0),
    bugSeq: Math.max(whole(value.bugSeq), ...bugs.map((bug) => bug.uid)),
  };
}

function readHolding(value: unknown): BolsaHolding {
  if (!isRecord(value)) return { units: ZERO, cost: ZERO };
  const read = (raw: unknown) => {
    const parsed = typeof raw === 'string' ? parseDecimal(raw) : typeof raw === 'number' && Number.isFinite(raw) ? parseDecimal(String(raw)) : ZERO;
    return Number.isNaN(parsed.toNumber()) || parsed.lt(0) ? ZERO : parsed;
  };
  const units = read(value.units);
  const cost = read(value.cost);
  // A holding with shares but no cost (or the reverse) is nothing.
  return units.gt(0) && cost.gt(0) ? { units, cost } : { units: ZERO, cost: ZERO };
}

function readHoras(value: unknown): HorasState {
  const horas = isRecord(value) ? value : {};
  const hours = (raw: unknown) => num(raw, 0, 0, 1e9);
  return { clicks: hours(horas.clicks), invasions: hours(horas.invasions), sprints: hours(horas.sprints), abilities: hours(horas.abilities), levels: hours(horas.levels) };
}

function readBolsa(value: unknown, content: GameContent, fallback: BolsaState): BolsaState {
  if (!isRecord(value)) return fallback;
  const cfg = content.maestrias.bolsa;
  const assets: Record<string, BolsaAssetState> = {};
  const saved = isRecord(value.assets) ? value.assets : {};
  for (const def of cfg.assets) {
    const entry = saved[def.id];
    if (!isRecord(entry)) continue;
    const price = num(entry.price, def.start, def.lo, def.hi);
    const history = Array.isArray(entry.history)
      ? entry.history.filter((p): p is number => typeof p === 'number' && Number.isFinite(p)).map((p) => Math.min(def.hi, Math.max(def.lo, p))).slice(-cfg.historyLength)
      : [];
    assets[def.id] = { price, history: history.length > 0 ? history : [price], held: readHolding(entry.held) };
  }
  return {
    at: num(value.at, 0, 0),
    step: whole(value.step),
    fundIndex: num(value.fundIndex, 1, 1, 1e6),
    fund: readHolding(value.fund),
    liquidity: num(value.liquidity, 0, 0, Math.max(...cfg.limitMinutes) * 60),
    assets,
  };
}

/** Tolerant reader: a missing or broken piece falls back to its default, an unknown Maestria is dropped. */
export function readMaestria(value: unknown, content: GameContent): MaestriaState {
  const maestria = createMaestriaState();
  if (!isRecord(value)) return maestria;

  if (isRecord(value.levels)) {
    for (const id of PROFESSOR_IDS) {
      if (!content.maestrias.defs[id].built) continue;
      const level = whole(value.levels[id], 0, MAESTRIA_MAX_LEVEL);
      if (level > 0) maestria.levels[id] = level;
    }
  }
  if (isRecord(value.joinha)) maestria.joinha.clicks = whole(value.joinha.clicks);
  if (isRecord(value.rollforward)) {
    maestria.rollforward = {
      clicks: whole(value.rollforward.clicks, 0, Math.max(0, content.maestrias.rollforward.clicksToFill - 1)),
      charges: whole(value.rollforward.charges, 0, Math.max(...content.maestrias.rollforward.maxCharges)),
    };
  }
  if (isRecord(value.swarm)) {
    maestria.swarm = {
      since: num(value.swarm.since, 0, 0),
      seq: whole(value.swarm.seq),
      active: readSwarm(value.swarm.active, content),
    };
    if (maestria.swarm.active) maestria.swarm.seq = Math.max(maestria.swarm.seq, maestria.swarm.active.uid);
  }
  if (isRecord(value.festa)) maestria.festa = { since: num(value.festa.since, 0, 0) };
  maestria.horas = readHoras(value.horas);
  maestria.bolsa = readBolsa(value.bolsa, content, maestria.bolsa);
  return maestria;
}
