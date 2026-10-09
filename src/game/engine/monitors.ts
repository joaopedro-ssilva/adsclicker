/**
 * Monitores: students hired with diplomas who take over a chore (buying classes, defending an
 * invasion, accepting a sprint, buying research). They run from the tick, never from a click.
 *
 * One rule keeps the achievements that ask for hands-on play honest: whatever a monitor does is
 * invisible to counters, run stats and the defence streak. Its purchases do not count as levels
 * bought (Índice Criado, Compra Coletiva, sprints of "buy N levels"), an invasion it defends is
 * neither defended nor missed (Cinco Seguidas, Firewall Humano, Zero Dia, Semestre Perfeito, "defend
 * N" sprints), a sprint it accepts that runs out is not failed, and no monitor ever clicks the
 * professor (Sem Mouse, Só no Clique). Nothing here calls markActive: automation is not the player acting.
 */
import { MONITOR_IDS } from '../content/types';
import type {
  DisciplineDef,
  GameContent,
  MonitorId,
  MonitorLevelDef,
  ProfessorDef,
  ResearchDef,
  Reward,
  SprintDef,
  SprintGoal,
} from '../content/types';
import type { Emit, MonitorsView } from '../store/types';
import { getIndex } from './contentIndex';
import { Decimal, parseDecimal } from './decimal';
import { disciplineProduction, hiredCount, levelOf, spend } from './economy';
import { levelCost, milestonesCrossed } from './formulas';
import { scheduleNextInvasion } from './invasions';
import { levelledLock, researchLock } from './requirements';
import { grantReward } from './rewards';
import { acceptSprint } from './sprints';
import { MONITOR_SHARES, SPRINT_PICKS } from './state';
import type { ActiveSprint, GameState, MonitorUnit, MonitorsState } from './state';
import { computeStats, hasFeature, invalidateStats } from './stats';

/** How soon a monitor that found nothing to do looks again (or its own delay, when shorter). */
const RETRY_MS = 1000;
/** Goals that are won by clicking, for the "only the click ones" preference. */
const CLICK_GOALS: readonly SprintGoal['kind'][] = ['clicks', 'crits', 'reachCombo', 'earnSeconds'];
/** A buff reward is worth about this many seconds of play per second of duration when comparing offers. */
const BUFF_WORTH = 2;

export function monitorsUnlocked(state: GameState): boolean {
  return state.counters.graduations >= 1;
}

/** The level the monitor works at, or null when it is not hired or the player switched it off. */
function workingLevel(state: GameState, content: GameContent, id: MonitorId): MonitorLevelDef | null {
  const unit = state.monitors.units[id];
  if (unit.level <= 0 || !unit.on) return null;
  return content.monitors.find((def) => def.id === id)?.levels[unit.level - 1] ?? null;
}

/** True when the monitor may act now; repairs a timer left far in the future by a clock that moved back. */
function due(unit: MonitorUnit, now: number, delayMs: number): boolean {
  if (unit.nextAt - now > delayMs) unit.nextAt = now;
  return now >= unit.nextAt;
}

function noteAct(state: GameState, id: MonitorId, what: string, now: number, delayMs: number, emit: Emit): void {
  const unit = state.monitors.units[id];
  unit.done += 1;
  unit.last = what;
  unit.nextAt = now + delayMs;
  emit({ type: 'monitorAct', monitor: id, id: what });
}

// ---------------------------------------------------------------------------
// Compras
// ---------------------------------------------------------------------------

/**
 * Buys one level of the discipline with the best output gain per coin, among those that cost at
 * most `comprasShare` of the coins in hand. It only considers professors the player already
 * started by hand (a level in any of their disciplines), so it never widens a run past the
 * professors the player chose (Turma Enxuta). Click upgrades are not touched.
 */
function bestDiscipline(state: GameState, content: GameContent): { def: DisciplineDef; cost: Decimal } | null {
  const index = getIndex(content);
  const stats = computeStats(state, content);
  const budget = state.coins.mul(state.monitors.settings.comprasShare);
  const started = new Set<string>();
  for (const def of content.disciplines) if (levelOf(state, def.id) > 0) started.add(def.professor);

  const hired = hiredCount(state);
  let best: { def: DisciplineDef; cost: Decimal; score: Decimal } | null = null;
  for (const def of content.disciplines) {
    const entry = index.levelled.get(def.id);
    if (!started.has(def.professor) || !entry || levelledLock(state, content, entry) !== null) continue;
    const level = levelOf(state, def.id);
    const cost = levelCost(index.baseCost.get(def.id) ?? parseDecimal('0'), level, stats);
    if (cost.gt(budget) || cost.lte(0)) continue;
    const gain = disciplineProduction(state, content, stats, def, level + 1, hired).sub(
      disciplineProduction(state, content, stats, def, level, hired),
    );
    if (gain.lte(0)) continue;
    const score = gain.div(cost);
    if (!best || score.gt(best.score)) best = { def, cost, score };
  }
  return best ? { def: best.def, cost: best.cost } : null;
}

function actBuyer(state: GameState, content: GameContent, now: number, emit: Emit): boolean {
  const level = workingLevel(state, content, 'compras');
  const unit = state.monitors.units.compras;
  if (!level || !due(unit, now, level.delayMs)) return false;

  const pick = bestDiscipline(state, content);
  if (!pick) {
    unit.nextAt = now + Math.min(level.delayMs, RETRY_MS);
    return false;
  }
  const from = levelOf(state, pick.def.id);
  spend(state, pick.cost);
  state.levels[pick.def.id] = from + 1;
  // Not counted in levelsBought, biggestPurchase, the run's levels or sprint progress (see the file header).
  invalidateStats(state);
  for (const milestone of milestonesCrossed(from, from + 1, content.balance)) {
    emit({ type: 'milestone', id: pick.def.id, level: milestone });
  }
  noteAct(state, 'compras', pick.def.id, now, level.delayMs, emit);
  return true;
}

// ---------------------------------------------------------------------------
// Pesquisa
// ---------------------------------------------------------------------------

/** The cheapest research that is open, not bought, and costs at most `pesquisaShare` of the coins in hand. */
function cheapestResearch(state: GameState, content: GameContent): { def: ResearchDef; cost: Decimal } | null {
  const budget = state.coins.mul(state.monitors.settings.pesquisaShare);
  let best: { def: ResearchDef; cost: Decimal } | null = null;
  for (const def of content.research) {
    if (state.research[def.id] || researchLock(state, content, def) !== null) continue;
    const cost = parseDecimal(def.cost);
    if (cost.gt(budget)) continue;
    if (!best || cost.lt(best.cost)) best = { def, cost };
  }
  return best;
}

function actResearcher(state: GameState, content: GameContent, now: number, emit: Emit): boolean {
  const level = workingLevel(state, content, 'pesquisa');
  const unit = state.monitors.units.pesquisa;
  if (!level || !due(unit, now, level.delayMs)) return false;

  const pick = cheapestResearch(state, content);
  if (!pick) {
    unit.nextAt = now + Math.min(level.delayMs, RETRY_MS);
    return false;
  }
  spend(state, pick.cost);
  state.research[pick.def.id] = true;
  invalidateStats(state);
  noteAct(state, 'pesquisa', pick.def.id, now, level.delayMs, emit);
  return true;
}

// ---------------------------------------------------------------------------
// Segurança
// ---------------------------------------------------------------------------

/**
 * Defends the invasion on stage once it has been there for the monitor's delay, for a share of the
 * reward. The streak is left exactly as it was and no defended counter moves: the monitor's
 * defences are invisible to the achievements that count the player's own.
 */
function actGuard(state: GameState, content: GameContent, now: number, rng: () => number, emit: Emit): boolean {
  const level = workingLevel(state, content, 'seguranca');
  const invasion = state.invasion;
  if (!level || !invasion || now < invasion.spawnedAt + level.delayMs || now >= invasion.expiresAt) return false;
  const def = getIndex(content).invasions.get(invasion.def);
  if (!def) return false;

  state.invasion = null;
  const reward = grantReward(state, content, def.reward, 'invasion', now, emit, level.share ?? 1);
  emit({ type: 'invasionDefended', uid: invasion.uid, def: def.id, reward, streak: state.eventStreak, byMonitor: true });
  scheduleNextInvasion(state, content, now, rng);
  noteAct(state, 'seguranca', def.id, now, 0, emit);
  return true;
}

// ---------------------------------------------------------------------------
// Sprints
// ---------------------------------------------------------------------------

/** Read through a function so the checks above do not narrow it: accepting a sprint changes it. */
function runningSprint(state: GameState): ActiveSprint | null {
  return state.sprint.active;
}

function rewardWorth(reward: Reward): number {
  return reward.kind === 'coins' ? reward.seconds : (reward.buff.durationMs / 1000) * BUFF_WORTH;
}

/** The offer the monitor takes under the player's preference, or null when none fits. */
function chooseSprint(state: GameState, content: GameContent): SprintDef | null {
  const index = getIndex(content);
  const offers: SprintDef[] = [];
  for (const id of state.sprint.offers) {
    const def = index.sprints.get(id);
    if (def) offers.push(def);
  }
  switch (state.monitors.settings.sprintPick) {
    case 'clicks':
      return offers.find((def) => CLICK_GOALS.includes(def.goal.kind)) ?? null;
    case 'best':
      return offers.reduce<SprintDef | null>((top, def) => (!top || rewardWorth(def.reward) > rewardWorth(top.reward) ? def : top), null);
    case 'first':
      return offers[0] ?? null;
  }
}

/**
 * Accepts an offer once the offers have been on screen for the monitor's delay. The sprint is
 * flagged `auto`: finishing it still takes the player, and running out costs nothing.
 */
function actPlanner(state: GameState, content: GameContent, now: number, emit: Emit): boolean {
  const level = workingLevel(state, content, 'sprints');
  const unit = state.monitors.units.sprints;
  if (!level) return false;
  if (state.sprint.active || state.sprint.offers.length === 0) {
    unit.nextAt = 0;
    return false;
  }
  if (unit.nextAt === 0) {
    unit.nextAt = now + level.delayMs;
    return false;
  }
  if (!due(unit, now, level.delayMs)) return false;

  const pick = chooseSprint(state, content);
  if (!pick || !acceptSprint(state, content, pick.id, now, emit)) {
    unit.nextAt = now + Math.max(RETRY_MS, Math.min(level.delayMs, 5000));
    return false;
  }
  const active = runningSprint(state);
  if (active) active.auto = true;
  noteAct(state, 'sprints', pick.id, now, 0, emit);
  unit.nextAt = 0;
  return true;
}

// ---------------------------------------------------------------------------
// Tick, actions and views
// ---------------------------------------------------------------------------

/**
 * Lets every hired, switched-on monitor do its chore. Called by the tick after invasions and sprint
 * offers were updated. A monitor acts at most once per call, however long the gap was.
 */
export function runMonitors(state: GameState, content: GameContent, now: number, rng: () => number, emit: Emit): void {
  if (!MONITOR_IDS.some((id) => state.monitors.units[id].level > 0)) return;
  // Research first: it is usually worth more than a level and should not be starved by Compras.
  const acted = [
    actResearcher(state, content, now, emit),
    actBuyer(state, content, now, emit),
    actGuard(state, content, now, rng, emit),
    actPlanner(state, content, now, emit),
  ];
  if (acted.some(Boolean)) invalidateStats(state);
}

/** Hires a monitor or raises it one level. Needs the first Formatura and the diplomas. */
export function buyMonitor(state: GameState, content: GameContent, id: MonitorId, emit: Emit): boolean {
  if (!monitorsUnlocked(state)) return false;
  const unit = state.monitors.units[id];
  const next = content.monitors.find((def) => def.id === id)?.levels[unit.level];
  if (!next || state.diplomas < next.cost) return false;

  state.diplomas -= next.cost;
  unit.level += 1;
  if (unit.level === 1) unit.on = true;
  unit.nextAt = 0;
  emit({ type: 'purchase', kind: 'monitor', id, levels: 1 });
  return true;
}

export function setMonitorOn(state: GameState, id: MonitorId, on: boolean): boolean {
  const unit = state.monitors.units[id];
  if (unit.level <= 0) return false;
  unit.on = on;
  unit.nextAt = 0;
  return true;
}

/** Applies the settings the UI offers; anything else is ignored. */
export function setMonitorSettings(state: GameState, patch: Partial<MonitorsState['settings']>): boolean {
  const settings = state.monitors.settings;
  const share = (value: number | undefined) => (value !== undefined && MONITOR_SHARES.includes(value) ? value : undefined);
  settings.comprasShare = share(patch.comprasShare) ?? settings.comprasShare;
  settings.pesquisaShare = share(patch.pesquisaShare) ?? settings.pesquisaShare;
  if (patch.sprintPick !== undefined && SPRINT_PICKS.includes(patch.sprintPick)) settings.sprintPick = patch.sprintPick;
  return true;
}

function professorWith(content: GameContent, feature: 'events' | 'sprints'): ProfessorDef | undefined {
  return Object.values(content.professors).find((professor) => professor.features.includes(feature));
}

/** The cards of the Formatura tab. */
export function monitorsView(state: GameState, content: GameContent): MonitorsView {
  const monitors = content.monitors.map((def) => {
    const unit = state.monitors.units[def.id];
    const next = def.levels[unit.level] ?? null;
    const current = unit.level > 0 ? def.levels[unit.level - 1] : undefined;

    let idle: string | null = null;
    if (unit.level > 0) {
      if (def.id === 'seguranca' && !hasFeature(state, content, 'events')) idle = `Sem invasões: contrate ${professorWith(content, 'events')?.name ?? 'o professor da segurança'}.`;
      if (def.id === 'sprints' && !hasFeature(state, content, 'sprints')) idle = `Sem sprints: contrate ${professorWith(content, 'sprints')?.name ?? 'o professor das sprints'}.`;
      if (def.id === 'compras' && !content.disciplines.some((entry) => levelOf(state, entry.id) > 0)) idle = 'Espera você comprar o primeiro nível de uma aula.';
    }

    return {
      id: def.id,
      name: def.name,
      emoji: def.emoji,
      description: def.description,
      level: unit.level,
      maxLevel: def.levels.length,
      on: unit.on,
      cost: next ? next.cost : null,
      affordable: next !== null && monitorsUnlocked(state) && state.diplomas >= next.cost,
      line: (current ?? def.levels[0])?.line ?? '',
      nextLine: next && unit.level > 0 ? next.line : null,
      done: unit.done,
      last: unit.last,
      idle,
    };
  });
  return { unlocked: monitorsUnlocked(state), monitors, settings: state.monitors.settings };
}
