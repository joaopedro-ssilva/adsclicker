import { PROFESSOR_IDS } from '../content/types';
import type { GameContent, ProfessorId } from '../content/types';
import type { Emit } from '../store/types';
import { Decimal, ZERO, parseDecimal } from './decimal';
import { createPostdocState } from './init';
import { masteryRank, postdocStars } from './mastery';
import type { GameState, PostdocState } from './state';

/**
 * Pós-doc: a professor whose Domínio is at the cap can defend it once per turma. It costs ADScoins, gives one
 * permanent star (up to `balance.postdoc.maxStars`) and the stars make that professor's Domínio bonuses stronger.
 *
 * The Domínio is the sum of this run's discipline levels, so the next graduation already takes it back to zero: the
 * "reset" is that the next star asks for the cap again, in a later turma (one defence per professor per turma).
 * Nothing is taken from the run: the levels stay, only the price is paid.
 */

/** Price of the star after the `owned` ones the professor already has (0 owned = the first star). */
export function postdocPrice(content: GameContent, owned: number): Decimal {
  const { firstPrice, priceGrowth } = content.balance.postdoc;
  return parseDecimal(firstPrice).mul(Decimal.pow(priceGrowth, Math.max(0, owned)));
}

/** What every star ever bought for `stars` stars cost together (the server's bound on a save's stars). */
export function postdocTotalPrice(content: GameContent, stars: number): Decimal {
  let total = ZERO;
  for (let owned = 0; owned < stars; owned += 1) total = total.add(postdocPrice(content, owned));
  return total;
}

export function totalPostdocStars(state: GameState): number {
  let total = 0;
  for (const id of PROFESSOR_IDS) total += postdocStars(state, id);
  return total;
}

export type PostdocBlock = 'notHired' | 'notMaxed' | 'maxStars' | 'defendedThisTurma' | 'broke';

export interface PostdocView {
  professor: ProfessorId;
  stars: number;
  maxStars: number;
  /** Price of the next star as a Decimal; null when the professor already has every star. */
  price: Decimal | null;
  /** Null when the defence can be made now. */
  blocked: PostdocBlock | null;
  /** The defence is allowed apart from the money (maxed Domínio, hired, star left, not yet this turma). */
  eligible: boolean;
}

export function postdocView(state: GameState, content: GameContent, professor: ProfessorId): PostdocView {
  const { maxStars } = content.balance.postdoc;
  const stars = postdocStars(state, professor);
  const price = stars >= maxStars ? null : postdocPrice(content, stars);
  let blocked: PostdocBlock | null = null;
  if (stars >= maxStars) blocked = 'maxStars';
  else if (!state.hired[professor]) blocked = 'notHired';
  else if (masteryRank(state, content, professor) < content.balance.mastery.cap) blocked = 'notMaxed';
  else if (state.postdoc.turma[professor] === state.counters.graduations) blocked = 'defendedThisTurma';
  const eligible = blocked === null;
  if (eligible && price && state.coins.lt(price)) blocked = 'broke';
  return { professor, stars, maxStars, price, blocked, eligible };
}

export function postdocViews(state: GameState, content: GameContent): PostdocView[] {
  return PROFESSOR_IDS.map((id) => postdocView(state, content, id));
}

export function canDefendPostdoc(state: GameState, content: GameContent, professor: ProfessorId): boolean {
  return postdocView(state, content, professor).blocked === null;
}

/** Pays the price and files the star. False (nothing changes) when the defence is not allowed or not affordable. */
export function defendPostdoc(state: GameState, content: GameContent, professor: ProfessorId, emit: Emit): boolean {
  const view = postdocView(state, content, professor);
  if (view.blocked !== null || !view.price) return false;
  state.coins = Decimal.max(ZERO, state.coins.sub(view.price));
  state.postdoc.stars[professor] = view.stars + 1;
  state.postdoc.turma[professor] = state.counters.graduations;
  state.counters.postdocs += 1;
  emit({ type: 'postdoc', professor, stars: view.stars + 1 });
  return true;
}

// ---------------------------------------------------------------------------
// Save reader
// ---------------------------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Tolerant reader: absent in older saves (no stars); stars are whole numbers within 0..maxStars. */
export function readPostdoc(value: unknown, content: GameContent): PostdocState {
  const result = createPostdocState();
  if (!isRecord(value)) return result;
  const { maxStars } = content.balance.postdoc;
  const stars = isRecord(value.stars) ? value.stars : {};
  const turma = isRecord(value.turma) ? value.turma : {};
  for (const id of PROFESSOR_IDS) {
    const n = stars[id];
    if (typeof n === 'number' && Number.isFinite(n)) result.stars[id] = Math.min(maxStars, Math.max(0, Math.floor(n)));
    const t = turma[id];
    if (typeof t === 'number' && Number.isFinite(t) && t >= 0) result.turma[id] = Math.floor(t);
  }
  return result;
}
