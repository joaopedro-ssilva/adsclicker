/** The Hackathon engine: pure TypeScript, identical in the browser and on the server. */
import * as build from './build';
import * as fight from './fight';
import * as loot from './loot';
import * as progression from './progression';
import { simulateRun as simulate } from './simulate';
import * as stage from './stage';
import type { HackathonEngine } from './types';

export * from './types';

// Typed as the contract so callers see the frozen signatures (some implementations ignore `content`).
const engine: HackathonEngine = {
  computeBuild: build.computeBuild,
  resolveStage: stage.resolveStage,
  createRun: fight.createRun,
  stepRun: (run, actions) => fight.stepRun(run, actions),
  simulateRun: simulate,
  rollDrops: loot.rollDrops,
  rerollAffix: loot.rerollAffix,
  rerollCost: loot.rerollCost,
  recycleValue: loot.recycleValue,
  itemScore: (item) => loot.itemScore(item),
  xpToNext: progression.xpToNext,
  applyXp: progression.applyXp,
  freeSkillPoints: progression.freeSkillPoints,
  nodeLock: progression.nodeLock,
  mentorCost: progression.mentorCost,
  classroomBonus: progression.classroomBonus,
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
