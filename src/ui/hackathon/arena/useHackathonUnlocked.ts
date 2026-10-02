import { useGameState } from '@/game/store';

/** The mode opens once the third professor (Bruna B2) was hired, now or ever (the achievement stays). */
export function useHackathonUnlocked(): boolean {
  return useGameState((state) => state.hired.b2 || (state.achievements['hire-b2'] ?? 0) > 0);
}
