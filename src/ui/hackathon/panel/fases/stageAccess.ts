import type { StageDef } from '@/hackathon/content';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { stageById } from '../lib/hk';

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
