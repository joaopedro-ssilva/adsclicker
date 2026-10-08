import { PROFESSOR_IDS } from '../content/types';
import type { Effect, GameContent, ProfessorId } from '../content/types';
import { getIndex } from './contentIndex';
import { formatPercent } from './format';
import type { GameState } from './state';

/** Sum of the levels of one professor's disciplines in the current run. */
export function masteryLevels(state: GameState, content: GameContent, professor: ProfessorId): number {
  let total = 0;
  for (const def of getIndex(content).disciplinesOf[professor]) total += state.levels[def.id] ?? 0;
  return total;
}

/** Domínio rank: one per `step` levels, up to `cap`. */
export function masteryRank(state: GameState, content: GameContent, professor: ProfessorId): number {
  const { step, cap } = content.balance.mastery;
  return Math.min(cap, Math.floor(masteryLevels(state, content, professor) / step));
}

export interface MasteryView {
  professor: ProfessorId;
  rank: number;
  cap: number;
  maxed: boolean;
  /** Levels summed over the professor's disciplines. */
  levels: number;
  /** Levels at which the next rank arrives (the cap's level when maxed). */
  nextAt: number;
  /** 0..1 progress from the current rank to the next. */
  progress: number;
  /** What the bonus is right now, ready to show: "Cada clique soma 1,5% das ADScoins/s da turma". */
  line: string;
  honoured: boolean;
}

/** How much the first/second perRank effect is worth at `rank`, as the plain number the line prints. */
function effectValue(effect: Effect, rank: number): number {
  return effect.op === 'add' ? effect.value * rank : Math.abs(effect.value ** rank - 1);
}

function formatValue(value: number, unit: 'percent' | 'hours' | undefined): string {
  if (unit === 'hours') return `${value.toFixed(1).replace('.', ',').replace(/,0$/, '')} h`;
  return formatPercent(value, value < 0.01 ? 2 : 1);
}

/** The line of a professor's Domínio at `rank`, with the numbers filled in. */
export function masteryLine(content: GameContent, professor: ProfessorId, rank: number): string {
  const def = content.mastery[professor];
  const [first, second] = def.perRank;
  return def.line
    .replace('{v}', first ? formatValue(effectValue(first, rank), def.units[0]) : '')
    .replace('{w}', second ? formatValue(effectValue(second, rank), def.units[1]) : '');
}

export function masteryView(state: GameState, content: GameContent, professor: ProfessorId): MasteryView {
  const { step, cap } = content.balance.mastery;
  const levels = masteryLevels(state, content, professor);
  const rank = Math.min(cap, Math.floor(levels / step));
  const maxed = rank >= cap;
  const from = rank * step;
  return {
    professor,
    rank,
    cap,
    maxed,
    levels,
    nextAt: maxed ? from : from + step,
    progress: maxed ? 1 : Math.min(1, (levels - from) / step),
    line: masteryLine(content, professor, rank),
    honoured: state.honoured === professor,
  };
}

/** Every professor's Domínio view, in hire order. */
export function masteryViews(state: GameState, content: GameContent): MasteryView[] {
  return PROFESSOR_IDS.map((id) => masteryView(state, content, id));
}
