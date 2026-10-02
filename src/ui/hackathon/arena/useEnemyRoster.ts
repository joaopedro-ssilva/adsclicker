import { useEffect, useState } from 'react';
import type { EnemyState } from '@/hackathon/engine';
import { EMPTY_ROSTER, prune, reconcile } from './roster';
import type { Roster } from './roster';

/** How long a defeated enemy stays on screen for its death animation. */
export const DEATH_MS = 520;

export function useEnemyRoster(enemies: EnemyState[], wave: number): Roster {
  const [roster, setRoster] = useState<Roster>(EMPTY_ROSTER);
  // Derived while rendering: the roster follows the enemies without an extra commit.
  const next = reconcile(roster, enemies, wave);
  if (next !== roster) setRoster(next);

  const dying = next.entries.some((entry) => entry.dying);
  useEffect(() => {
    if (!dying) return;
    const timer = setTimeout(() => setRoster((current) => prune(current)), DEATH_MS);
    return () => clearTimeout(timer);
  }, [dying]);

  return next;
}
