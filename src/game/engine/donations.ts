/**
 * Centro Comunitário: giving ADScoins to the campus. A pure sink with no gameplay power; the lifetime total
 * (`state.donated`) decides a title (content/donations.ts) and a place on the donors board.
 */
import type { GameContent } from '../content/types';
import { donationTitles } from '../content/donations';
import type { DonationTitleDef } from '../content/donations';
import type { Emit } from '../store/types';
import { afterAction } from './lifecycle';
import { Decimal, parseDecimal } from './decimal';
import { spend } from './economy';
import type { GameState } from './state';

/** The least a donation can be: one whole ADScoin. */
export const MIN_DONATION = new Decimal(1);

/** The highest title earned with `donated` in total, or null below the first one. */
export function donationTitleFor(donated: Decimal): DonationTitleDef | null {
  let current: DonationTitleDef | null = null;
  for (const title of donationTitles) if (donated.gte(parseDecimal(title.threshold))) current = title;
  return current;
}

export interface DonationProgress {
  current: DonationTitleDef | null;
  /** The next title to earn, or null with every title earned. */
  next: DonationTitleDef | null;
  /** ADScoins still to give for `next` (zero with no next). */
  missing: Decimal;
  /** 0..1 from the current threshold to the next, on the log scale of the thresholds. */
  progress: number;
}

/** Where `donated` stands among the titles: the one held, the next, how much is missing and how far along. */
export function donationProgress(donated: Decimal): DonationProgress {
  const current = donationTitleFor(donated);
  const next = donationTitles.find((title) => donated.lt(parseDecimal(title.threshold))) ?? null;
  if (!next) return { current, next: null, missing: new Decimal(0), progress: 1 };
  const target = parseDecimal(next.threshold);
  const floorLog = current ? parseDecimal(current.threshold).log10() : 0;
  const span = target.log10() - floorLog;
  const here = donated.lte(1) ? 0 : donated.log10();
  const progress = span > 0 ? Math.min(1, Math.max(0, (here - floorLog) / span)) : 0;
  return { current, next, missing: target.sub(donated), progress };
}

/**
 * Gives `amount` ADScoins to the campus: it must be at least one coin and no more than the coins in hand.
 * Returns false (and changes nothing) otherwise. Survives graduation: the total and the count are lifetime numbers.
 */
export function donateToCampus(state: GameState, content: GameContent, amount: Decimal, now: number, emit: Emit): boolean {
  if (!Number.isFinite(amount.m) || !Number.isFinite(amount.e)) return false;
  if (amount.lt(MIN_DONATION) || amount.gt(state.coins)) return false;
  const before = donationTitleFor(state.donated);
  spend(state, amount);
  state.donated = state.donated.add(amount);
  state.counters.donations += 1;
  const after = donationTitleFor(state.donated);
  emit({ type: 'donate', amount, total: state.donated, title: after && after.id !== before?.id ? after.id : null });
  afterAction(state, content, now, emit);
  return true;
}
