import type { StageDef } from '@/hackathon/content';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { CAMPAIGN, stageById } from '../lib/hk';

export type StageState = 'cleared' | 'open' | 'locked';

/** Why a campaign stage is closed, in words, or null when the player can enter. Mirrors the server's rule. */
export function stageLock(stage: StageDef, profile: HackathonProfile): string | null {
  if (profile.level < stage.requiredLevel) return `Requer nível ${stage.requiredLevel} (você está no ${profile.level})`;
  if (stage.requires && (profile.stages[stage.requires]?.clears ?? 0) < 1) {
    return `Vença “${stageById.get(stage.requires)?.name ?? stage.requires}” primeiro`;
  }
  return null;
}

export function stageState(stage: StageDef, profile: HackathonProfile): StageState {
  if (stageLock(stage, profile)) return 'locked';
  return (profile.stages[stage.id]?.clears ?? 0) > 0 ? 'cleared' : 'open';
}

/** The lock in a few words, for the nodes of the path where the full sentence would not fit. */
export function stageLockShort(stage: StageDef, profile: HackathonProfile): string | null {
  if (profile.level < stage.requiredLevel) return `Requer nível ${stage.requiredLevel}`;
  if (stage.requires && (profile.stages[stage.requires]?.clears ?? 0) < 1) return 'Vença a fase anterior';
  return null;
}

/** The stage to offer first: the earliest one that is open and not cleared, else the last of the chapter. */
export function frontierStage(profile: HackathonProfile): StageDef {
  const stage = CAMPAIGN.find((entry) => stageState(entry, profile) === 'open') ?? CAMPAIGN[CAMPAIGN.length - 1];
  if (!stage) throw new Error('The campaign has no stages');
  return stage;
}

/** How many stages of the chapter have been won at least once. */
export function clearedCount(profile: HackathonProfile): number {
  return CAMPAIGN.filter((stage) => (profile.stages[stage.id]?.clears ?? 0) > 0).length;
}
