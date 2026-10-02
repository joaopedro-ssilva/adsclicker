import type { EnemyState } from '@/hackathon/engine';

/** An enemy on the field: alive, or a ghost kept on screen for its death animation. */
export interface RosterEntry {
  enemy: EnemyState;
  slot: number;
  dying: boolean;
  /** Joined after the wave started (a split): it pops in instead of walking in. */
  spawned: boolean;
}

export interface Roster {
  wave: number;
  /** How many enemies the wave started with: decides where each one stands. */
  groupSize: number;
  entries: RosterEntry[];
  /** The list this roster was built from, so the same input gives the same roster. */
  source: EnemyState[] | null;
}

export const EMPTY_ROSTER: Roster = { wave: -1, groupSize: 0, entries: [], source: null };

function freeSlot(entries: RosterEntry[]): number {
  const used = new Set(entries.map((entry) => entry.slot));
  let slot = 0;
  while (used.has(slot)) slot += 1;
  return slot;
}

/**
 * Follows the enemies tick by tick. An enemy keeps its place for the whole wave, one that disappears stays as a
 * dying ghost until `prune`, and a newcomer (a split) takes the first free place.
 */
export function reconcile(roster: Roster, allEnemies: EnemyState[], wave: number): Roster {
  // The engine keeps a defeated enemy in the list with 0 HP until the wave ends: for the screen it is gone.
  const enemies = allEnemies.filter((enemy) => enemy.hp > 0);
  if (roster.source === allEnemies && roster.wave === wave) return roster;
  if (wave !== roster.wave) {
    return {
      wave,
      groupSize: enemies.length,
      entries: enemies.map((enemy, slot) => ({ enemy, slot, dying: false, spawned: false })),
      source: allEnemies,
    };
  }
  const alive = new Map(enemies.map((enemy) => [enemy.uid, enemy]));
  const entries: RosterEntry[] = roster.entries.map((entry) => {
    const now = alive.get(entry.enemy.uid);
    return now ? { ...entry, enemy: now, dying: false } : { ...entry, enemy: { ...entry.enemy, hp: 0, chargeLandsAt: null }, dying: true };
  });
  for (const enemy of enemies) {
    if (!entries.some((entry) => entry.enemy.uid === enemy.uid)) {
      entries.push({ enemy, slot: freeSlot(entries), dying: false, spawned: true });
    }
  }
  return { ...roster, entries, source: allEnemies };
}

/** Drops the ghosts of enemies that finished dying. */
export function prune(roster: Roster): Roster {
  if (!roster.entries.some((entry) => entry.dying)) return roster;
  return { ...roster, entries: roster.entries.filter((entry) => !entry.dying) };
}
