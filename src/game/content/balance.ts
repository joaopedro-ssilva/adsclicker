import type { BalanceConfig } from './types';

/** Every tunable constant of the rules. The simulator adjusts these, not the engine. */
export const balance: BalanceConfig = {
  costGrowth: 1.15,
  minCostGrowth: 1.07,
  milestones: [10, 25, 50, 100, 200],
  milestoneStep: 100,
  milestoneMult: 2,
  // The old classes catch up with the new ones through the late milestones: x2 up to 100, then x3, x3, x4.
  // Past 400 every 100 levels is x2 again (cost growth wins from there).
  milestoneMults: { 200: 3, 300: 3, 400: 4 },
  // Domínio: a rank per 25 levels summed over a professor's three disciplines. 40 ranks = 1,000 levels,
  // about 333 each: just past the x3 milestone at 300 and short of the x4 at 400, so it is a late-game goal.
  mastery: { step: 25, cap: 40 },
  tierUnlockLevel: 10,
  baseClick: 1,
  combo: { windowMs: 1500, baseMax: 20, baseStep: 0.05, decayPerSecond: 4 },
  crit: { baseChance: 0.03, baseMult: 7 },
  // 1 = off: the professor on screen earns no bonus (the "em sala" bonus confused players and was removed).
  activeBonus: 1,
  achievementBonus: 0.01,
  offline: { baseHours: 2, baseRate: 0.5, minAwayMs: 60_000 },
  events: { minIntervalMs: 75_000, maxIntervalMs: 150_000 },
  sprints: { offers: 3, cooldownMs: 150_000 },
  rewardClickFloor: 50,
  // A fast human drums about 10-14 clicks a second; a script goes well past 15. Hold-to-click (Joinha de Ouro) is 10.
  clickLimit: { perSecond: 15, windowMs: 1000 },
  // The cap makes sitting on a run pointless: at most 10 diplomas on the first graduation, 13 on the second, 16, 21...
  // (x1.3 each: tuned with the simulator so late runs settle around 20-30 min for an active player instead of collapsing).
  graduation: { base: '2e19', exponent: 0.5, bonusPerDiploma: 0.01, maxBonus: 1, cap: { base: 10, growth: 1.3 } },
};
