import { useGameState } from '@/game/store';

/**
 * The entrance to the mode is closed for now: the owner wants the clicker solid first. Nothing of the mode was
 * removed; flip this to true to bring back the mode button and the invitation.
 */
export const HACKATHON_OPEN = false;

/** The mode opens once the third professor (Bruna B2) was hired, now or ever (the achievement stays). */
export function useHackathonUnlocked(): boolean {
  const reached = useGameState((state) => state.hired.b2 || (state.achievements['hire-b2'] ?? 0) > 0);
  return HACKATHON_OPEN && reached;
}
