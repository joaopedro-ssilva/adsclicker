/**
 * What a sync pays the Hackathon profile for what happened in the classroom (docs/HACKATHON.md).
 *
 * - Bought Café: the profile remembers how many purchases it has already credited. New ones are
 *   credited up to the per-day cap and up to the room left in the bar (the Café never goes above
 *   the maximum). A purchase that does not fit stays pending and is credited by a later sync once
 *   there is room, so paying for a Café while the bar is full is not wasted.
 * - Graduations: each new one refills the Café and gives XP, up to the per-day cap. The ones past
 *   the cap are not carried over: a graduation is an event, not something bought.
 * - A save whose counters went backwards credits nothing, and the remembered values never go down.
 */
export interface CreditProfile {
  cafesBoughtCredited: number;
  graduationsCredited: number;
  /** Day the two "today" counters belong to. */
  creditDay: string;
  cafesCreditedToday: number;
  graduationsCreditedToday: number;
}

export interface CreditCounters {
  cafesBought: number;
  graduations: number;
}

export interface CreditInput {
  counters: CreditCounters;
  profile: CreditProfile;
  dateKey: string;
  /** Café that still fits in the bar. */
  cafeRoom: number;
  caps: { cafesPerDay: number; graduationsPerDay: number };
}

export interface CreditPlan extends CreditProfile {
  /** Café to add. */
  cafes: number;
  /** Graduations that pay (each refills the Café and gives XP). */
  graduations: number;
}

const whole = (value: number): number => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);

export function planClassroomCredit(input: CreditInput): CreditPlan {
  const { profile, caps } = input;
  const sameDay = profile.creditDay === input.dateKey;
  const cafesToday = sameDay ? profile.cafesCreditedToday : 0;
  const graduationsToday = sameDay ? profile.graduationsCreditedToday : 0;

  const bought = whole(input.counters.cafesBought);
  const pending = Math.max(0, bought - profile.cafesBoughtCredited);
  const cafes = Math.max(0, Math.min(pending, caps.cafesPerDay - cafesToday, input.cafeRoom));

  const graduated = whole(input.counters.graduations);
  const fresh = Math.max(0, graduated - profile.graduationsCredited);
  const graduations = Math.max(0, Math.min(fresh, caps.graduationsPerDay - graduationsToday));

  return {
    cafesBoughtCredited: profile.cafesBoughtCredited + cafes,
    graduationsCredited: Math.max(profile.graduationsCredited, graduated),
    creditDay: input.dateKey,
    cafesCreditedToday: cafesToday + cafes,
    graduationsCreditedToday: graduationsToday + graduations,
    cafes,
    graduations,
  };
}

/** True when the counters hold something that could pay: lets a sync skip the transaction otherwise. */
export function hasPendingCredit(counters: CreditCounters, profile: CreditProfile): boolean {
  return whole(counters.cafesBought) > profile.cafesBoughtCredited || whole(counters.graduations) > profile.graduationsCredited;
}
