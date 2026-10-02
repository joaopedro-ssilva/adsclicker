/**
 * Placeholder with the final signatures: the engine engineer owns and replaces this file.
 * Everything throws until then, so the server and the UI can compile against the contract.
 */
import type { HackathonEngine } from './types';

export * from './types';

const pending = (name: string) => (): never => {
  throw new Error(`hackathon engine: ${name} is not implemented yet`);
};

const engine: HackathonEngine = {
  computeBuild: pending('computeBuild'),
  resolveStage: pending('resolveStage'),
  createRun: pending('createRun'),
  stepRun: pending('stepRun'),
  simulateRun: pending('simulateRun'),
  rollDrops: pending('rollDrops'),
  rerollAffix: pending('rerollAffix'),
  rerollCost: pending('rerollCost'),
  recycleValue: pending('recycleValue'),
  itemScore: pending('itemScore'),
  xpToNext: pending('xpToNext'),
  applyXp: pending('applyXp'),
  freeSkillPoints: pending('freeSkillPoints'),
  nodeLock: pending('nodeLock'),
  mentorCost: pending('mentorCost'),
  classroomBonus: pending('classroomBonus'),
};

export const {
  computeBuild,
  resolveStage,
  createRun,
  stepRun,
  simulateRun,
  rollDrops,
  rerollAffix,
  rerollCost,
  recycleValue,
  itemScore,
  xpToNext,
  applyXp,
  freeSkillPoints,
  nodeLock,
  mentorCost,
  classroomBonus,
} = engine;
