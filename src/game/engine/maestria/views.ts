import { MAESTRIA_MAX_LEVEL, PROFESSOR_IDS } from '../../content/types';
import type { GameContent, ProfessorId } from '../../content/types';
import type { Decimal } from '../decimal';
import { ZERO } from '../decimal';
import { formatDuration, formatNumber } from '../format';
import type { GameState } from '../state';
import { assetOpen, bolsaInvested, bolsaLevel, bolsaLimit, bolsaLimitSeconds, bolsaRoom, fundRate, holdingValue } from './bolsa';
import { activeFesta, festaCharge, festaRechargeMs } from './festa';
import { horasBands, horasCapacity, horasCounted } from './horas';
import { releaseBonusPerVersion, releaseSprintsPerVersion, releaseVersions } from './releases';
import { goldenCanCrit, goldenReady, goldenSeconds, joinhaClicksNeeded } from './joinha';
import { atLevel } from './production';
import { rollforwardJumpMs, rollforwardMaxCharges } from './rollforward';
import { freeSlots, maestriaLevel, maestriaNextCost, unlockedMaestrias } from './slots';
import { swarmCharge, swarmChargeMs } from './swarm';
import type { ActiveSwarm } from './types';

// ---------------------------------------------------------------------------
// Formatura tab: the eight cards
// ---------------------------------------------------------------------------

export interface MaestriaCardView {
  professor: ProfessorId;
  name: string;
  summary: string;
  built: boolean;
  level: number;
  maxLevel: number;
  unlocked: boolean;
  /** A free slot can be put here now. */
  canUnlock: boolean;
  /** Diplomas for the next level, or null at the top or while locked. */
  nextCost: number | null;
  affordable: boolean;
  /** What each level adds, level 1 first. Empty while the Maestria is not built. */
  levels: string[];
}

export interface MaestriasView {
  /** Shown from the first graduation on (or while any Maestria is unlocked). */
  visible: boolean;
  slots: { total: number; used: number; free: number };
  cards: MaestriaCardView[];
}

const whole = (value: number) => formatNumber(value, { integer: true });
const seconds = (ms: number) => `${formatNumber(ms / 1000, { integer: true })} s`;
const percent = (value: number) => `${Number((value * 100).toFixed(2)).toString().replace(".", ",")}%`;
const times = (value: number) => `×${value.toFixed(2).replace('.', ',').replace(/,?0+$/, '')}`;

/** One line per level for a built Maestria, with the numbers from the content. */
export function maestriaLevelLines(content: GameContent, professor: ProfessorId): string[] {
  const cfg = content.maestrias;
  const lines: string[] = [];
  for (let level = 1; level <= MAESTRIA_MAX_LEVEL; level += 1) {
    if (professor === 'edecio') {
      const j = cfg.joinha;
      let line = `A cada ${whole(atLevel(j.clicksNeeded, level))} cliques, um clique de ouro vale ${whole(atLevel(j.seconds, level))} s da produção.`;
      if (level === j.critFromLevel) line += ' Ele pode ser crítico.';
      if (level === j.holdFromLevel) line += ` Segure o mouse: ${whole(j.holdPerSecond)} cliques por segundo.`;
      lines.push(line);
    } else if (professor === 'gladimir') {
      const r = cfg.rollforward;
      const charges = atLevel(r.maxCharges, level);
      lines.push(
        `Cada carga (${whole(r.clicksToFill)} cliques) avança ${whole(atLevel(r.jumpSeconds, level))} s.` +
          (charges > 1 ? ` Guarda ${charges} cargas.` : ''),
      );
    } else if (professor === 'b2') {
      const d = cfg.designSystem;
      const reach = atLevel(d.reach, level);
      lines.push(
        `${percent(atLevel(d.chance, level))} de chance por nível comprado: ${reach === 1 ? '1 aula mais barata ganha' : `${reach} aulas mais baratas ganham`} 1 nível grátis.`,
      );
    } else if (professor === 'guto') {
      const f = cfg.festa;
      lines.push(
        `Recarga de ${whole(atLevel(f.rechargeMinutes, level))} min. A festa dura ${whole(atLevel(f.seconds, level))} s: produção ${times(atLevel(f.power, level))}, recargas e invasões ${times(1 / atLevel(f.cooldown, level))} mais rápidas.`,
      );
    } else if (professor === 'b1') {
      const r = cfg.releases;
      lines.push(
        `A cada ${whole(atLevel(r.sprintsPerVersion, level))} sprints sai uma versão: +${percent(atLevel(r.bonus, level))} de produção cada, até ${whole(r.maxVersions)} por turma.`,
      );
    } else if (professor === 'angelo') {
      const h = cfg.horas;
      const bands = atLevel(h.bands, level);
      lines.push(`${whole(bands)} faixas de ${whole(h.hoursPerBand)} horas: até ${whole(bands)} diplomas extras por formatura, fora do limite.`);
    } else if (professor === 'pablo') {
      const b = cfg.bolsa;
      const open = b.assets.filter((asset) => asset.unlockLevel === level).map((asset) => asset.name);
      lines.push(
        `Investe até ${whole(atLevel(b.limitMinutes, level))} min de produção; o Fundo rende ${percent(atLevel(b.fundPerMinute, level))} por minuto.` +
          (level === 1 ? ' Abre a GPU.' : open.length > 0 ? ` Abre: ${open.join(', ')}.` : ''),
      );
    } else if (professor === 'wagner') {
      const s = cfg.swarm;
      const every = atLevel(s.firewallEveryMs, level);
      lines.push(
        `Carrega em ${whole(atLevel(s.chargeMinutes, level))} min, prêmio ${times(atLevel(s.rewardMult, level))}.` +
          (every > 0 ? ` O firewall derruba um bug a cada ${seconds(every)}.` : ''),
      );
    }
  }
  return lines;
}

export function maestriasView(state: GameState, content: GameContent): MaestriasView {
  const used = unlockedMaestrias(state).length;
  const free = freeSlots(state);
  const cards = PROFESSOR_IDS.map((professor): MaestriaCardView => {
    const def = content.maestrias.defs[professor];
    const level = maestriaLevel(state, professor);
    const nextCost = maestriaNextCost(state, content, professor);
    return {
      professor,
      name: def.name,
      summary: def.summary,
      built: def.built,
      level,
      maxLevel: MAESTRIA_MAX_LEVEL,
      unlocked: level > 0,
      canUnlock: def.built && level === 0 && free > 0,
      nextCost,
      affordable: nextCost !== null && state.diplomas >= nextCost,
      levels: def.built ? maestriaLevelLines(content, professor) : [],
    };
  });
  return {
    visible: state.counters.graduations > 0 || used > 0,
    slots: { total: used + free, used, free },
    cards,
  };
}

// ---------------------------------------------------------------------------
// Stage: the charges and buttons
// ---------------------------------------------------------------------------

export interface JoinhaView {
  level: number;
  /** Manual clicks since the last golden one, and how many the next one needs. */
  clicks: number;
  needed: number;
  /** The next click is golden. */
  ready: boolean;
  seconds: number;
  canCrit: boolean;
  /** Holding the pointer on the professor clicks by itself. */
  canHold: boolean;
  holdPerSecond: number;
}

export function joinhaView(state: GameState, content: GameContent): JoinhaView | null {
  const level = maestriaLevel(state, 'edecio');
  if (level <= 0) return null;
  const needed = joinhaClicksNeeded(state, content);
  return {
    level,
    clicks: Math.min(needed, state.maestria.joinha.clicks),
    needed,
    ready: goldenReady(state, content),
    seconds: goldenSeconds(state, content),
    canCrit: goldenCanCrit(state, content),
    canHold: level >= content.maestrias.joinha.holdFromLevel,
    holdPerSecond: content.maestrias.joinha.holdPerSecond,
  };
}

export interface RollforwardView {
  level: number;
  charges: number;
  maxCharges: number;
  /** Clicks towards the next charge, and how many fill one. */
  clicks: number;
  toFill: number;
  jumpMs: number;
  ready: boolean;
}

export function rollforwardView(state: GameState, content: GameContent): RollforwardView | null {
  const level = maestriaLevel(state, 'gladimir');
  if (level <= 0) return null;
  const roll = state.maestria.rollforward;
  return {
    level,
    charges: roll.charges,
    maxCharges: rollforwardMaxCharges(state, content),
    clicks: roll.clicks,
    toFill: content.maestrias.rollforward.clicksToFill,
    jumpMs: rollforwardJumpMs(state, content),
    ready: roll.charges >= 1,
  };
}

export interface SwarmView {
  level: number;
  /** 0..1 of the charge. */
  charge: number;
  chargeLeftMs: number;
  /** Charged and no swarm in progress. */
  ready: boolean;
  active: ActiveSwarm | null;
  /** Bugs in a swarm, boss apart. */
  bugs: number;
}

/** `now` defaults to the last tick, like abilityViews. */
export function swarmView(state: GameState, content: GameContent, now: number = state.lastTickAt): SwarmView | null {
  const level = maestriaLevel(state, 'wagner');
  if (level <= 0) return null;
  const charge = swarmCharge(state, content, now);
  const total = swarmChargeMs(state, content);
  const active = state.maestria.swarm.active;
  return {
    level,
    charge,
    chargeLeftMs: Math.max(0, total * (1 - charge)),
    ready: active === null && charge >= 1,
    active,
    bugs: content.maestrias.swarm.bugs,
  };
}

// ---------------------------------------------------------------------------
// Guto: the party
// ---------------------------------------------------------------------------

export interface FestaView {
  level: number;
  /** 0..1 of the recharge. */
  charge: number;
  chargeLeftMs: number;
  /** Charged and no party going. */
  ready: boolean;
  /** Time left and total of the party in progress, or null. */
  active: { leftMs: number; totalMs: number } | null;
  /** What the party does at this level. */
  seconds: number;
  power: number;
  cooldown: number;
  invasions: number;
}

export function festaView(state: GameState, content: GameContent, now: number = state.lastTickAt): FestaView | null {
  const level = maestriaLevel(state, 'guto');
  if (level <= 0) return null;
  const cfg = content.maestrias.festa;
  const charge = festaCharge(state, content, now);
  const buff = activeFesta(state, now);
  return {
    level,
    charge,
    chargeLeftMs: Math.max(0, festaRechargeMs(state, content) * (1 - charge)),
    ready: buff === null && charge >= 1,
    active: buff ? { leftMs: Math.max(0, buff.endsAt - now), totalMs: Math.max(1, buff.endsAt - buff.startedAt) } : null,
    seconds: atLevel(cfg.seconds, level),
    power: atLevel(cfg.power, level),
    cooldown: atLevel(cfg.cooldown, level),
    invasions: atLevel(cfg.invasions, level),
  };
}

// ---------------------------------------------------------------------------
// B1: the version of the run
// ---------------------------------------------------------------------------

export interface ReleasesView {
  level: number;
  versions: number;
  maxVersions: number;
  maxed: boolean;
  /** Sprints completed towards the next version, and how many it takes. */
  sprints: number;
  perVersion: number;
  /** Production each version adds, and what the shipped ones add together (0.09 = +9%). */
  bonusPerVersion: number;
  bonus: number;
}

export function releasesView(state: GameState, content: GameContent): ReleasesView | null {
  const level = maestriaLevel(state, 'b1');
  if (level <= 0) return null;
  const per = releaseSprintsPerVersion(state, content);
  const versions = releaseVersions(state, content);
  const maxVersions = content.maestrias.releases.maxVersions;
  const bonusPerVersion = releaseBonusPerVersion(state, content);
  return {
    level,
    versions,
    maxVersions,
    maxed: versions >= maxVersions,
    sprints: versions >= maxVersions ? per : state.run.sprintsCompleted - versions * per,
    perVersion: per,
    bonusPerVersion,
    bonus: bonusPerVersion * versions,
  };
}

// ---------------------------------------------------------------------------
// Angelo: the hours bar
// ---------------------------------------------------------------------------

export interface HorasView {
  level: number;
  bands: number;
  perBand: number;
  /** Hours counted (no activity above its share), the most the bar holds, and the bands filled: the diplomas the next graduation adds. */
  hours: number;
  capacity: number;
  filled: number;
  sources: { key: keyof GameState['maestria']['horas']; label: string; hours: number; cap: number }[];
}

const HORAS_LABELS: { key: keyof GameState['maestria']['horas']; label: string }[] = [
  { key: 'clicks', label: 'Cliques' },
  { key: 'invasions', label: 'Invasões defendidas' },
  { key: 'sprints', label: 'Sprints concluídas' },
  { key: 'abilities', label: 'Habilidades usadas' },
  { key: 'levels', label: 'Níveis comprados' },
];

export function horasView(state: GameState, content: GameContent): HorasView | null {
  const level = maestriaLevel(state, 'angelo');
  if (level <= 0) return null;
  const perBand = content.maestrias.horas.hoursPerBand;
  const capacity = horasCapacity(state, content);
  const hours = horasCounted(state, content);
  const cap = capacity * content.maestrias.horas.sourceShare;
  return {
    level,
    bands: horasBands(state, content),
    perBand,
    hours,
    capacity,
    filled: Math.min(horasBands(state, content), Math.floor(hours / perBand + 1e-9)),
    sources: HORAS_LABELS.map(({ key, label }) => ({ key, label, hours: Math.min(cap, state.maestria.horas[key]), cap })),
  };
}

// ---------------------------------------------------------------------------
// Pablo: the market
// ---------------------------------------------------------------------------

export interface BolsaAssetView {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  temperament: 'calm' | 'cyclic' | 'spiky';
  /** Opened by the Maestria's level. */
  open: boolean;
  unlockLevel: number;
  price: number;
  lo: number;
  hi: number;
  /** Prices, oldest first. */
  history: number[];
  /** Change since the previous step (0.02 = +2%). */
  change: number;
  /** What the player holds: current value, coins paid and the difference. */
  value: Decimal;
  cost: Decimal;
  profit: Decimal;
  held: boolean;
}

export interface BolsaView {
  level: number;
  /** The market has opened (the first tick after unlocking it). */
  open: boolean;
  limit: Decimal;
  invested: Decimal;
  room: Decimal;
  /** The most coins the player may have in, in minutes of production. */
  limitMinutes: number;
  /** 0..1 of the profit the market can still pay. */
  liquidity: number;
  assets: BolsaAssetView[];
  fund: { value: Decimal; cost: Decimal; profit: Decimal; held: boolean; ratePerMinute: number; index: number };
  /** Everything held, at today's prices. */
  totalValue: Decimal;
}

export function bolsaView(state: GameState, content: GameContent): BolsaView | null {
  const level = bolsaLevel(state);
  if (level <= 0) return null;
  const bolsa = state.maestria.bolsa;
  const assets = content.maestrias.bolsa.assets.map((def): BolsaAssetView => {
    const entry = bolsa.assets[def.id];
    const price = entry?.price ?? def.start;
    const history = entry?.history ?? [price];
    const previous = history.length > 1 ? (history[history.length - 2] ?? price) : price;
    const held = entry?.held;
    const value = held ? holdingValue(held, price) : ZERO;
    const cost = held?.cost ?? ZERO;
    return {
      id: def.id,
      name: def.name,
      emoji: def.emoji,
      blurb: def.blurb,
      temperament: def.temperament,
      open: assetOpen(state, def),
      unlockLevel: def.unlockLevel,
      price,
      lo: def.lo,
      hi: def.hi,
      history,
      change: previous > 0 ? price / previous - 1 : 0,
      value,
      cost,
      profit: value.sub(cost),
      held: value.gt(0),
    };
  });
  const fundValue = holdingValue(bolsa.fund, bolsa.fundIndex);
  const limitSeconds = bolsaLimitSeconds(state, content);
  let totalValue = fundValue;
  for (const asset of assets) totalValue = totalValue.add(asset.value);
  return {
    level,
    open: bolsa.at > 0,
    limit: bolsaLimit(state, content),
    invested: bolsaInvested(state),
    room: bolsaRoom(state, content),
    limitMinutes: limitSeconds / 60,
    liquidity: limitSeconds > 0 ? Math.min(1, bolsa.liquidity / limitSeconds) : 0,
    assets,
    fund: {
      value: fundValue,
      cost: bolsa.fund.cost,
      profit: fundValue.sub(bolsa.fund.cost),
      held: fundValue.gt(0),
      ratePerMinute: fundRate(state, content),
      index: bolsa.fundIndex,
    },
    totalValue,
  };
}

/** Text of the party for a tooltip. */
export function festaText(view: FestaView): string {
  return `${formatDuration(view.seconds * 1000)} de caos: produção ${times(view.power)}, habilidades disparam de uma vez e recarregam ${times(1 / view.cooldown)} mais rápido, invasões ${times(1 / view.invasions)} mais seguido.`;
}
