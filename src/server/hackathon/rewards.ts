import type { CargoId, HackathonContent } from '@/hackathon/content/types';
import type { Build, ItemInstance, ResolvedStage } from '@/hackathon/engine/types';

/** XP and Commits of a finished stage, before the drops and the level-up. */
export interface BaseRewards {
  xp: number;
  commits: number;
}

export interface RewardInput {
  won: boolean;
  stage: ResolvedStage;
  build: Build;
  firstClear: boolean;
  content: HackathonContent;
}

const percent = (value: number | undefined): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/**
 * Victory: the stage's XP and Commits, grown by the build's `xpGain` / `commitsGain`; Commits are
 * multiplied on the first clear. Defeat: the XP share only. (The daily stage's `xpPercent` rule is
 * already in the XP the engine resolved for it.)
 */
export function baseRewards(input: RewardInput): BaseRewards {
  const { stage, build, content } = input;
  const fullXp = Math.floor(stage.xp * Math.max(0, 1 + percent(build.meta.xpGain) / 100));
  if (!input.won) return { xp: Math.floor(fullXp * content.config.defeatXpShare), commits: 0 };
  const first = input.firstClear ? content.config.firstClear.commitsMultiplier : 1;
  const commits = Math.floor(stage.commits * Math.max(0, 1 + percent(build.meta.commitsGain) / 100) * first);
  return { xp: fullXp, commits };
}

export interface FitResult {
  kept: ItemInstance[];
  recycled: ItemInstance[];
  /** Commits for the items that did not fit. */
  recycledCommits: number;
}

/** The inventory holds `limit` items: what overflows is recycled into Commits, in drop order. */
export function fitInventory(drops: ItemInstance[], owned: number, limit: number, recycleValue: (item: ItemInstance) => number): FitResult {
  const room = Math.max(0, limit - owned);
  const kept = drops.slice(0, room);
  const recycled = drops.slice(room);
  const recycledCommits = recycled.reduce((sum, item) => sum + Math.max(0, Math.floor(recycleValue(item))), 0);
  return { kept, recycled, recycledCommits };
}

/** The cargo after `current`, or null at the last one. */
export function nextCargo(content: HackathonContent, current: CargoId): CargoId | null {
  const ordered = [...content.cargos].sort((a, b) => a.order - b.order);
  const index = ordered.findIndex((cargo) => cargo.id === current);
  return ordered[index + 1]?.id ?? null;
}

/** The cargo a first victory in `stageId` promotes to, or null (not a promotion stage, not a first clear, or no next cargo). */
export function promotionFor(
  content: HackathonContent,
  cargo: CargoId,
  stageId: string,
  won: boolean,
  firstClear: boolean,
): CargoId | null {
  if (!won || !firstClear) return null;
  const def = content.cargos.find((candidate) => candidate.id === cargo);
  if (!def || def.promotionStage !== stageId) return null;
  return nextCargo(content, cargo);
}
