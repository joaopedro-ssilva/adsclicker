import type { GameContent, SprintDef } from '../content/types';
import { acceptSprint } from '../engine/actions';
import { deserializeState, serializeState } from '../engine/save';
import { eligibleSprints } from '../engine/sprints';
import type { GameState } from '../engine/state';
import { hasFeature } from '../engine/stats';
import { PROFILES } from './profiles';
import { simulate } from './simulate';
import type { SimOptions } from './simulate';

export interface SprintAuditCell {
  /** False when the sprint is not on the table at that moment (layer or requirement missing). */
  eligible: boolean;
  trials: number;
  /** Times the active player finished it inside the deadline. */
  active: number;
  /** Times a player who does nothing (no clicks, no purchases, no defending) finished it. */
  idle: number;
}

export interface SprintAudit {
  checkpoints: number[];
  rows: { sprint: SprintDef; cells: SprintAuditCell[] }[];
}

const PLAY_NOTHING: SimOptions = { clicksPerSecond: 0, defendRate: 0, decisionMs: 1e12 };

/** Plays one forced sprint from a copy of `base` and tells whether it was finished in time. */
function trySprint(content: GameContent, base: GameState, def: SprintDef, options: SimOptions, seed: number): boolean | null {
  const copy = deserializeState(serializeState(base), content, base.lastTickAt);
  if (!copy) return null;
  copy.sprint = { offers: [def.id], active: null, nextOffersAt: copy.lastTickAt + 1e12 };
  if (!hasFeature(copy, content, 'sprints') || !eligibleSprints(copy, content).some((s) => s.id === def.id)) return null;
  if (!acceptSprint(copy, content, def.id, copy.lastTickAt, () => undefined)) return null;

  const elapsed = (copy.lastTickAt - base.createdAt) / 1000;
  const result = simulate(content, {
    ...options,
    from: copy,
    maxSeconds: elapsed + def.durationMs / 1000 + 2,
    stopWhenDone: false,
    graduate: false,
    seed,
    until: (state) => state.sprint.active === null,
  });
  return (result.sprints[def.id]?.done ?? 0) > 0;
}

/**
 * Checks every sprint at a few moments of a normal active run: can the active player finish it
 * inside the deadline, and can a player who does nothing? Each cell is `trials` forced attempts
 * with different seeds, started from a copy of the state the active strategy reached.
 */
export function auditSprints(content: GameContent, checkpoints: number[], trials = 8): SprintAudit {
  const rows = content.sprints.map((sprint) => ({ sprint, cells: [] as SprintAuditCell[] }));
  for (const at of checkpoints) {
    const base = simulate(content, { ...PROFILES.active.options, maxSeconds: at, stopWhenDone: false }).finalState;
    for (const row of rows) {
      const cell: SprintAuditCell = { eligible: false, trials: 0, active: 0, idle: 0 };
      for (let seed = 1; seed <= trials; seed += 1) {
        const played = trySprint(content, base, row.sprint, PROFILES.active.options, seed);
        if (played === null) break;
        cell.eligible = true;
        cell.trials += 1;
        if (played) cell.active += 1;
        if (trySprint(content, base, row.sprint, PLAY_NOTHING, seed)) cell.idle += 1;
      }
      row.cells.push(cell);
    }
  }
  return { checkpoints, rows };
}
