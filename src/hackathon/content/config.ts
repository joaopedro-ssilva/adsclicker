import type { HackathonConfig } from './types';

/** The starting knobs of docs/HACKATHON.md, kept as designed; the balancing pass tunes them. */
export const config: HackathonConfig = {
  baseStats: { logica: 10, agilidade: 100, foco: 120, resiliencia: 0, atencao: 5, sorte: 0 },
  statsPerLevel: { logica: 2, foco: 15 },
  xpBase: 100,
  xpStep: 60,
  defeatXpShare: 0.3,
  enemyScaling: { hpPercentPerLevel: 18, damagePercentPerLevel: 12 },
  itemValuePercentPerLevel: 8,
  flow: { minIntervalMs: 4000 },
  autoSkillPower: 0.8,
  critMultiplier: 2,
  cafe: { max: 5, regenMinutes: 15, boughtPerDayCap: 12 },
  graduation: { xp: 150, perDayCap: 3 },
  inventorySize: 40,
  pityVictories: 40,
  baseDropExtra: 10,
  bossDrops: 2,
  firstClear: { minRarity: 'incomum', commitsMultiplier: 2 },
  reroll: { baseCommits: 50 },
  respecCommits: 200,
  mentorClassroomBonus: 0.1,
  minRunTimeShare: 0.5,
  daily: { waves: 5, modifiers: 2 },
  runExpiryMinutes: 30,
};
