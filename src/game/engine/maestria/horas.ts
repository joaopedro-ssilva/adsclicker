import type { GameContent } from '../../content/types';
import type { GameState } from '../state';
import { atLevel } from './levelTable';
import { activeMaestriaLevel } from './slots';
import type { HorasState } from './types';

export type HorasSource = keyof HorasState;

/** Bands open at the current level; 0 when Angelo's Maestria is not unlocked. */
export function horasBands(state: GameState, content: GameContent): number {
  const level = activeMaestriaLevel(state, 'angelo');
  return level > 0 ? atLevel(content.maestrias.horas.bands, level) : 0;
}

/** Hours the whole bar holds. */
export function horasCapacity(state: GameState, content: GameContent): number {
  return horasBands(state, content) * content.maestrias.horas.hoursPerBand;
}

const WEIGHT_OF: Record<HorasSource, keyof GameContent['maestrias']['horas']['weights']> = {
  clicks: 'click',
  invasions: 'invasion',
  sprints: 'sprint',
  abilities: 'ability',
  levels: 'level',
};

/** Called when the player does something: clicks, a defended invasion, a completed sprint, an ability, levels bought. */
export function recordHoras(state: GameState, content: GameContent, source: HorasSource, amount = 1): void {
  if (activeMaestriaLevel(state, 'angelo') <= 0 || amount <= 0) return;
  state.maestria.horas[source] += amount * content.maestrias.horas.weights[WEIGHT_OF[source]];
}

/** Hours counted, with no single activity above its share of the bar. */
export function horasCounted(state: GameState, content: GameContent): number {
  const cap = horasCapacity(state, content) * content.maestrias.horas.sourceShare;
  const total = (Object.keys(WEIGHT_OF) as HorasSource[]).reduce((sum, source) => sum + Math.min(cap, state.maestria.horas[source]), 0);
  return Math.min(horasCapacity(state, content), total);
}

/** Bands filled so far: the extra diplomas the next graduation pays, outside the cap. */
export function horasBandsFilled(state: GameState, content: GameContent): number {
  const bands = horasBands(state, content);
  if (bands <= 0) return 0;
  return Math.min(bands, Math.floor(horasCounted(state, content) / content.maestrias.horas.hoursPerBand + 1e-9));
}

/** Most extra diplomas one graduation can pay with Angelo's Maestria at `level`. */
export function horasMaxDiplomas(content: GameContent, level: number): number {
  return level > 0 ? atLevel(content.maestrias.horas.bands, level) : 0;
}
