import type { GameState } from './state';

/**
 * A sitting only keeps counting while the player acts: a tab left open and untouched for longer
 * than this stops the clock, so "1 hour in one sitting" cannot be earned by leaving the game on.
 */
export const SESSION_IDLE_MS = 120_000;

const DAY_MS = 86_400_000;

/** Starts a new sitting. The store calls it when the game boots. */
export function startSession(state: GameState, now: number): void {
  state.session = { seconds: 0, activeAt: now };
}

/** The player did something (any action of the engine goes through afterAction). */
export function markActive(state: GameState, now: number): void {
  state.session.activeAt = Math.max(state.session.activeAt, now);
}

/** Adds the span [from, to] of play to the sitting, when the player was acting during it. */
export function countSession(state: GameState, seconds: number, to: number): void {
  if (to - state.session.activeAt <= SESSION_IDLE_MS) state.session.seconds += seconds;
}

/** Day number in the player's own time zone, so "the same day" matches the clock on their wall. */
export function localDay(now: number): number {
  return Math.floor((now - new Date(now).getTimezoneOffset() * 60_000) / DAY_MS);
}

/** Keeps the streak of consecutive days played. Idempotent within a day. */
export function touchCalendar(state: GameState, now: number): void {
  const day = localDay(now);
  const calendar = state.calendar;
  if (day === calendar.day) return;
  calendar.streak = calendar.day > 0 && day === calendar.day + 1 ? calendar.streak + 1 : 1;
  calendar.day = day;
  state.counters.bestDayStreak = Math.max(state.counters.bestDayStreak, calendar.streak);
}

/** Counts a graduation made at `now` against its calendar day. */
export function recordGraduationDay(state: GameState, now: number): void {
  const day = localDay(now);
  const calendar = state.calendar;
  calendar.gradsToday = calendar.gradDay === day ? calendar.gradsToday + 1 : 1;
  calendar.gradDay = day;
}
