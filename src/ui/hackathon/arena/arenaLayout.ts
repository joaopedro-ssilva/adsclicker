import { ASSETS } from '@/ui/art/manifest';
import type { ResolvedStage } from '@/hackathon/engine';
import { enemyById } from '../shared/lookup';

/** Native pixels the student takes (hair and shadow included), and the gap kept between the sides. */
export const PLAYER_NATIVE = { w: 60, h: 102 };
const SIDE_GAP = 16;
const MIN_SCALE = 1;
const MAX_SCALE = 6;
/** From this width the student and the wave each take half of the field; below it they share one row. */
export const SPLIT_WIDTH = 720;

export interface SlotPosition {
  /** Centre of the sprite as a fraction of the enemy zone's width. */
  x: number;
  /** Lift from the ground line, in native pixels (back rows stand a little higher). */
  depth: number;
}

const BY_GROUP_SIZE: Record<number, SlotPosition[]> = {
  1: [{ x: 0.5, depth: 0 }],
  2: [
    { x: 0.3, depth: 0 },
    { x: 0.74, depth: 8 },
  ],
  3: [
    { x: 0.17, depth: 0 },
    { x: 0.83, depth: 0 },
    { x: 0.5, depth: 18 },
  ],
};

/** Enemies that join mid-wave (splits) stand around the middle of the zone. */
const EXTRA: SlotPosition[] = [
  { x: 0.3, depth: 0 },
  { x: 0.7, depth: 0 },
  { x: 0.5, depth: 14 },
  { x: 0.15, depth: 14 },
  { x: 0.85, depth: 14 },
];

export function slotPosition(slot: number, groupSize: number): SlotPosition {
  const size = Math.min(3, Math.max(1, groupSize));
  const inGroup = slot < size ? BY_GROUP_SIZE[size]?.[slot] : undefined;
  if (inGroup) return inGroup;
  return EXTRA[Math.max(0, slot - size) % EXTRA.length] ?? { x: 0.5, depth: 0 };
}

const spriteOf = (asset: string) => ASSETS[asset] ?? { w: 40, h: 46 };

/**
 * The widest front row of enemies the stage can ever show, and the tallest enemy, in native pixels. Three or
 * more stand in two rows, so only the two widest count.
 */
export function enemyFootprint(stage: Pick<ResolvedStage, 'waves'>): { w: number; h: number } {
  let w = 0;
  let h = 0;
  for (const wave of stage.waves) {
    const sprites = wave.map((id) => spriteOf(enemyById.get(id)?.asset ?? ''));
    const front = sprites.map((sprite) => sprite.w).sort((a, b) => b - a).slice(0, 2);
    w = Math.max(w, front.reduce((sum, width) => sum + width, 0) + 6 * Math.max(0, front.length - 1));
    h = Math.max(h, ...sprites.map((sprite) => sprite.h));
  }
  return { w, h };
}

/**
 * Largest whole-number zoom at which the student and the widest wave fit the box. On a wide field each side has its
 * own half (the student around a quarter of the width, the wave around three quarters); on a phone they share the row.
 */
export function pickScale(box: { width: number; height: number }, stage: Pick<ResolvedStage, 'waves'>): number {
  const enemies = enemyFootprint(stage);
  const needHeight = Math.max(PLAYER_NATIVE.h, enemies.h + 20);
  const half = box.width / 2;
  const byWidth =
    box.width >= SPLIT_WIDTH
      ? Math.min(Math.floor((half * 0.9) / PLAYER_NATIVE.w), Math.floor((half * 0.96) / enemies.w))
      : Math.floor((box.width * 0.94) / (PLAYER_NATIVE.w + SIDE_GAP + enemies.w));
  // The small bar (and name) over each enemy takes 34px, and the floor of the art some margin under the feet.
  const byHeight = Math.floor((box.height * 0.94 - 34) / needHeight);
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, byWidth, byHeight));
}
