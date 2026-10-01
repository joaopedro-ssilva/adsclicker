import type { SkinDef } from '@/game/content/types';
import { PixelGrid } from './pixelGrid';
import { hashSeed, shade } from './procedural';

/** The anchor is the point that rests on top of the head. */
export const PROCEDURAL_HAT = { w: 44, h: 26, anchor: { x: 22, y: 18 } } as const;

const OUTLINE = '#1a1620';
const STYLES = ['cap', 'crown', 'wizard', 'helmet'] as const;

function cap(g: PixelGrid, { primary, secondary, accent }: SkinDef['palette']): void {
  g.ellipse(21.5, 17, 15, 11, primary);
  g.rect(6, 17, 32, 5, primary);
  g.rect(18, 3, 7, 3, accent);
  g.rect(6, 21, 32, 2, shade(primary, -0.25));
  g.rect(28, 19, 16, 4, secondary);
  g.rect(28, 22, 16, 1, shade(secondary, -0.3));
}

function crown(g: PixelGrid, { accent, primary }: SkinDef['palette']): void {
  const gold = shade(accent, 0.1);
  g.rect(7, 12, 30, 10, gold);
  for (const x of [7, 17, 27]) {
    g.rect(x, 5, 10, 8, gold);
    g.rect(x + 3, 2, 4, 4, gold);
  }
  g.rect(7, 19, 30, 3, shade(gold, -0.25));
  for (const x of [10, 20, 30]) g.rect(x, 14, 4, 4, primary);
}

function wizard(g: PixelGrid, { primary, secondary, accent }: SkinDef['palette']): void {
  for (let row = 0; row < 20; row += 1) {
    const half = 1 + Math.floor(row * 0.5);
    g.rect(22 - half + Math.floor(row * 0.1), row + 1, half * 2, 1, primary);
  }
  g.rect(2, 20, 40, 4, primary);
  g.rect(2, 22, 40, 2, shade(primary, -0.25));
  g.rect(10, 16, 25, 4, secondary);
  g.rect(21, 7, 3, 3, accent);
  g.rect(17, 12, 2, 2, accent);
  g.rect(26, 11, 2, 2, accent);
}

function helmet(g: PixelGrid, { primary, secondary, accent }: SkinDef['palette']): void {
  g.ellipse(22, 17, 17, 14, primary);
  g.rect(5, 17, 34, 6, primary);
  g.rect(5, 21, 34, 2, shade(primary, -0.3));
  g.rect(20, 0, 4, 10, accent);
  g.rect(16, 3, 12, 3, accent);
  g.rect(17, 14, 10, 4, secondary);
  g.fill(shade(primary, 0.2), (x, y) => g.get(x, y) === primary && x < 14 && y < 14);
}

/** A deterministic hat from the hat asset key (cap, crown, wizard hat or helmet) in the skin palette. */
export function drawHat(key: string, palette: SkinDef['palette']): PixelGrid {
  const g = new PixelGrid(PROCEDURAL_HAT.w, PROCEDURAL_HAT.h);
  const style = STYLES[hashSeed(key) % STYLES.length] ?? 'cap';
  if (style === 'cap') cap(g, palette);
  else if (style === 'crown') crown(g, palette);
  else if (style === 'wizard') wizard(g, palette);
  else helmet(g, palette);
  g.outline(OUTLINE);
  return g;
}
