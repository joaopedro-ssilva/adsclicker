import type { HackathonProfile } from '@/shared/hackathonApi';
import { saoPauloDateKey } from '../lib/dateKey';
import { useNow } from '../lib/useNow';

/** The day key (the server's) and whether the daily Hackathon has been won today. */
export function useDailyStatus(profile: HackathonProfile): {
  dateKey: string;
  won: boolean;
  clears: number;
} {
  const dateKey = saoPauloDateKey(useNow(60_000));
  const today = profile.daily.dateKey === dateKey;
  return {
    dateKey,
    won: today && profile.daily.clears > 0,
    clears: today ? profile.daily.clears : 0,
  };
}
