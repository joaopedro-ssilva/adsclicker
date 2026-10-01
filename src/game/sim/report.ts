import type { GameContent, ProfessorId } from '../content/types';
import { PROFESSOR_IDS } from '../content/types';
import { formatDuration, formatNumber } from '../engine/format';
import type { SprintAudit } from './audit';
import type { MilestoneResult, RunRecord, SimResult } from './simulate';

const pad = (text: string, width: number): string => (text.length >= width ? text : text + ' '.repeat(width - text.length));
const padLeft = (text: string, width: number): string => (text.length >= width ? text : ' '.repeat(width - text.length) + text);
const time = (seconds: number | null | undefined): string => (seconds === null || seconds === undefined ? '—' : formatDuration(seconds * 1000));
const percent = (fraction: number): string => `${Math.round(fraction * 100)}%`;

/** How the simulated time compares with the target window. */
function verdict(milestone: MilestoneResult): string {
  if (milestone.reachedAt === null) return 'não chegou';
  const { target, reachedAt } = milestone;
  if (!target) return '—';
  if (reachedAt < target.min) return 'cedo demais';
  if (reachedAt > target.max) return 'tarde demais';
  return 'ok';
}

export function milestoneTable(result: SimResult): string[] {
  const lines = [`${pad('Marco', 30)}${pad('Meta', 20)}${pad('Simulado', 14)}Situação`, '-'.repeat(78)];
  for (const milestone of result.milestones) {
    lines.push(
      `${pad(milestone.label, 30)}${pad(milestone.targetText, 20)}${pad(time(milestone.reachedAt), 14)}${verdict(milestone)}`,
    );
  }
  return lines;
}

/** Hire times of each run (seconds since the run began) with the gap to the previous hire. */
export function hireTable(result: SimResult, content: GameContent): string[] {
  const names = PROFESSOR_IDS.slice(1).map((id) => content.professors[id].name);
  const width = 22;
  const lines = [`${pad('Corrida', 9)}${names.map((n) => padLeft(n, width)).join('')}`, '-'.repeat(9 + width * names.length)];
  for (const run of result.runs.slice(0, 6)) {
    let previous = 0;
    const cells = PROFESSOR_IDS.slice(1).map((id: ProfessorId) => {
      const at = run.hires[id];
      if (at === undefined) return padLeft('—', width);
      const gap = at - previous;
      previous = Math.max(previous, at);
      return padLeft(`${time(at)} (+${formatDuration(Math.max(0, gap) * 1000)})`, width);
    });
    lines.push(`${pad(`#${run.index + 1}`, 9)}${cells.join('')}`);
  }
  return lines;
}

export function runTable(result: SimResult): string[] {
  const lines = [
    `${pad('Corrida', 9)}${pad('Duração', 12)}${pad('Total', 12)}${pad('Angelo em', 12)}${pad('Pablo em', 12)}${pad('Diplomas', 10)}${pad('Acumulado', 11)}${pad('ADScoins', 10)}${pad('Prod/Clq/Auto/Inv/Spr', 24)}Opções`,
    '-'.repeat(124),
  ];
  const shown: RunRecord[] = result.runs.slice(0, 14);
  for (const run of shown) {
    const length = run.endedAt === null ? null : run.endedAt - run.startedAt;
    lines.push(
      pad(`#${run.index + 1}`, 9) +
        pad(run.endedAt === null ? `(${time(result.seconds - run.startedAt)})` : time(length), 12) +
        pad(time(run.endedAt ?? result.seconds), 12) +
        pad(time(run.hires.angelo), 12) +
        pad(time(run.hires.pablo), 12) +
        pad(run.endedAt === null ? '—' : String(run.diplomas), 10) +
        pad(run.endedAt === null ? '—' : String(run.diplomasTotal), 11) +
        pad(formatNumber(run.runCoins), 10) +
        pad(['production', 'click', 'auto', 'invasions', 'sprints'].map((k) => String(Math.round(run.shares[k as keyof typeof run.shares] * 100))).join('/'), 24) +
        (run.endedAt === null ? '' : String(run.options)),
    );
  }
  if (result.runs.length > shown.length) lines.push(`… mais ${result.runs.length - shown.length} corridas`);
  return lines;
}

export function timelineTable(result: SimResult, everySeconds: number): string[] {
  const lines = [
    `${pad('Tempo', 12)}${pad('ADScoins/s', 13)}${pad('Prof.', 6)}${pad('Dipl.', 8)}${pad('Conq.', 7)}${pad('Prod.', 7)}${pad('Clique', 8)}${pad('Auto', 7)}${pad('Invas.', 8)}${pad('Sprint', 8)}Offline`,
    '-'.repeat(95),
  ];
  let next = 0;
  result.timeline.forEach((sample, i) => {
    if (sample.seconds < next && i !== result.timeline.length - 1) return;
    next = sample.seconds + everySeconds - 1;
    const s = sample.shares;
    lines.push(
      pad(time(sample.seconds), 12) +
        pad(formatNumber(sample.coinsPerSecond), 13) +
        pad(String(sample.professors), 6) +
        pad(String(sample.diplomasEarned), 8) +
        pad(String(sample.achievements), 7) +
        pad(percent(s.production), 7) +
        pad(percent(s.click), 8) +
        pad(percent(s.auto), 7) +
        pad(percent(s.invasions), 8) +
        pad(percent(s.sprints), 8) +
        percent(s.offline),
    );
  });
  return lines;
}

export function treeSummary(result: SimResult, content: GameContent): string[] {
  const { prestige } = result.finalState;
  let nodes = 0;
  let levels = 0;
  let maxLevels = 0;
  let totalCost = 0;
  for (const def of content.prestigeNodes) {
    const level = prestige[def.id] ?? 0;
    if (level > 0) nodes += 1;
    levels += level;
    maxLevels += def.maxLevel;
    for (let l = 0; l < def.maxLevel; l += 1) totalCost += Math.ceil(def.cost * def.costGrowth ** l - 1e-9);
  }
  const spent = result.finalState.diplomasEarned - result.finalState.diplomas;
  return [
    `Árvore: ${nodes}/${content.prestigeNodes.length} nós, ${levels}/${maxLevels} níveis, ${spent} de ${totalCost} diplomas gastos (${result.finalState.diplomas} guardados)`,
  ];
}

export function sprintSummary(result: SimResult, content: GameContent): string[] {
  const lines = [`${pad('Sprint', 30)}${padLeft('aceitos', 9)}${padLeft('feitos', 9)}${padLeft('falhos', 9)}`];
  for (const def of content.sprints) {
    const stat = result.sprints[def.id];
    if (!stat) continue;
    lines.push(`${pad(def.name, 30)}${padLeft(String(stat.started), 9)}${padLeft(String(stat.done), 9)}${padLeft(String(stat.failed), 9)}`);
  }
  return lines;
}

export function unreachedAchievements(result: SimResult, content: GameContent): string[] {
  return content.achievements
    .filter((def) => def.condition.kind !== 'secret' && result.achievementTimes[def.id] === undefined)
    .map((def) => `${def.id} (${def.name})`);
}

/** Research purchases with the cost in seconds of income and the payback. */
export function researchAudit(result: SimResult, content: GameContent, firstRunOnly = true): string[] {
  const names = new Map(content.research.map((r) => [r.id, r.name]));
  const lines = [
    `${pad('Pesquisa', 28)}${pad('Quando', 12)}${padLeft('custo (s de renda)', 20)}${padLeft('ganho', 9)}${padLeft('retorno', 12)}`,
    '-'.repeat(81),
  ];
  const limit = firstRunOnly ? (result.runs[0]?.endedAt ?? Infinity) : Infinity;
  for (const p of result.purchases) {
    if (p.kind !== 'research' || p.at > limit) continue;
    const seconds = p.income.gt(0) ? p.cost.div(p.income).toNumber() : Infinity;
    const gain = p.income.gt(0) ? p.gain.div(p.income).toNumber() : 0;
    const payback = p.gain.gt(0) ? p.cost.div(p.gain).toNumber() : Infinity;
    lines.push(
      pad(names.get(p.id) ?? p.id, 28) +
        pad(time(p.at), 12) +
        padLeft(Number.isFinite(seconds) ? formatDuration(seconds * 1000) : '—', 20) +
        padLeft(gain > 0 ? `+${(gain * 100).toFixed(gain < 0.1 ? 1 : 0)}%` : '—', 9) +
        padLeft(Number.isFinite(payback) ? formatDuration(payback * 1000) : '—', 12),
    );
  }
  return lines;
}

/** Sprint audit: "active/idle" successes out of the trials, per checkpoint ("-" when not on offer). */
export function sprintAuditTable(audit: SprintAudit): string[] {
  const head = audit.checkpoints.map((at) => padLeft(time(at), 13)).join('');
  const lines = [`${pad('Sprint', 28)}${padLeft('prazo', 8)}${head}`, '-'.repeat(36 + 13 * audit.checkpoints.length)];
  for (const row of audit.rows) {
    const cells = row.cells.map((cell) => padLeft(cell.eligible ? `${cell.active}/${cell.trials} · ${cell.idle}/${cell.trials}` : '-', 13));
    lines.push(`${pad(row.sprint.name, 28)}${padLeft(`${row.sprint.durationMs / 1000}s`, 8)}${cells.join('')}`);
  }
  lines.push('(ativo · sem fazer nada)');
  return lines;
}
