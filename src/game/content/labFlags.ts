/**
 * Facts about the Laboratório the engine notes by name in GameState.secrets when they happen, read by the achievements
 * through `flag` conditions. One place for the names, so the engine and the content cannot drift apart.
 */

/** A boss of the lab was beaten (any run). */
export const labBossFlag = (enemyId: string): string => `lab-boss:${enemyId}`;

export const LAB_FLAGS = {
  /** The first boss of a run was beaten with a single item equipped. */
  minimalist: 'lab-minimalist',
  /** Phase 10 or later was cleared with the starting Mouse quebrado still in the ferramenta slot. */
  starterMouse: 'lab-starter-mouse',
  /** Phase 10 was reached in a run with no click on the monitor. */
  noHands: 'lab-no-hands',
} as const;

/** The phase the "Sem as Mãos" and "Mouse de Estimação" feats look at. */
export const LAB_FEAT_PHASE = 10;
