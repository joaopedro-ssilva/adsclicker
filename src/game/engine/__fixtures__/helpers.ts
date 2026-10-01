import type { GameContent, ProfessorId } from '../../content/types';
import type { Emit, GameEvent } from '../../store/types';
import { Decimal } from '../decimal';
import { createInitialState } from '../init';
import { createRng } from '../rng';
import type { GameState } from '../state';
import { createFixtureContent } from './content';

export const T0 = 1_700_000_000_000;

export interface TestGame {
  content: GameContent;
  state: GameState;
  events: GameEvent[];
  emit: Emit;
  rng: () => number;
}

/** A fresh game over the fixture content. `mutate` may edit the content before the first use. */
export function newGame(mutate?: (content: GameContent) => void): TestGame {
  const content = createFixtureContent();
  mutate?.(content);
  const events: GameEvent[] = [];
  return {
    content,
    state: createInitialState(content, T0),
    events,
    emit: (event) => events.push(event),
    rng: createRng(7),
  };
}

/** Like newGame, with no achievements in the content so nothing unlocks (and boosts production) unexpectedly. */
export function newCleanGame(mutate?: (content: GameContent) => void): TestGame {
  return newGame((content) => {
    content.achievements = [];
    mutate?.(content);
  });
}

export function hire(state: GameState, ...ids: ProfessorId[]): void {
  for (const id of ids) state.hired[id] = true;
}

export function coins(state: GameState, value: number | string): void {
  state.coins = new Decimal(value);
}

/** Events of one type, narrowed. */
export function eventsOf<T extends GameEvent['type']>(events: GameEvent[], type: T): Extract<GameEvent, { type: T }>[] {
  return events.filter((event): event is Extract<GameEvent, { type: T }> => event.type === type);
}

/** An rng that returns the given values in order, then the last one forever. */
export function sequence(...values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)] ?? 0;
}

export function num(value: Decimal): number {
  return value.toNumber();
}
