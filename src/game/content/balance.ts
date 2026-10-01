import type { BalanceConfig } from './types';

/** Every tunable constant of the rules. The simulator adjusts these, not the engine. */
export const balance: BalanceConfig = {
  costGrowth: 1.15,
  minCostGrowth: 1.07,
  milestones: [10, 25, 50, 100, 200],
  milestoneStep: 100,
  milestoneMult: 2,
  tierUnlockLevel: 10,
  baseClick: 1,
  combo: { windowMs: 1500, baseMax: 20, baseStep: 0.05, decayPerSecond: 4 },
  crit: { baseChance: 0.03, baseMult: 7 },
  activeBonus: 1.5,
  achievementBonus: 0.01,
  offline: { baseHours: 2, baseRate: 0.5, minAwayMs: 60_000 },
  events: { minIntervalMs: 75_000, maxIntervalMs: 150_000 },
  sprints: { offers: 3, cooldownMs: 60_000 },
  rewardClickFloor: 50,
  graduation: { base: '1e12', exponent: 0.5, bonusPerDiploma: 0.02 },
};
