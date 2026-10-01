import type { SkinDef } from '@/game/content/types';
import { PixelGrid } from './pixelGrid';
import { hashSeed, mixColors, shade } from './procedural';

/** Same footprint and neck anchor as the real body sprites. */
export const PROCEDURAL_BODY = { w: 38, h: 52, neck: { x: 19, y: 1 } } as const;

const OUTLINE = '#1a1620';
const SHOES = ['#f4f1ea', '#2b2b36', '#c8503f'] as const;

/** Chibi body: small torso, short limbs. Outfit colours come from the skin palette, details from the seed. */
export function drawBody(seed: string, palette: SkinDef['palette'], skin: string): PixelGrid {
  const g = new PixelGrid(PROCEDURAL_BODY.w, PROCEDURAL_BODY.h);
  const hash = hashSeed(`${seed}:body`);
  const { primary, secondary, accent } = palette;
  const skinShadow = shade(skin, -0.14);
  const primaryShadow = shade(primary, -0.2);
  const secondaryShadow = shade(secondary, -0.22);
  const longSleeves = hash % 3 === 0;
  const shoe = SHOES[hash % SHOES.length] ?? SHOES[0];

  // Legs and shoes
  g.rect(9, 28, 9, 17, secondary);
  g.rect(20, 28, 9, 17, secondary);
  g.rect(15, 28, 3, 17, secondaryShadow);
  g.rect(26, 28, 3, 17, secondaryShadow);
  g.ellipse(12.5, 47.5, 6.5, 4, shoe, 2.4);
  g.ellipse(25.5, 47.5, 6.5, 4, shoe, 2.4);
  g.fill(shade(shoe, -0.2), (x, y) => y >= 49 && g.get(x, y) === shoe);

  // Arms: sleeve, bare forearm (unless long sleeves) and a round hand
  for (const side of [-1, 1] as const) {
    const x = side < 0 ? 1 : 31;
    g.rect(x, 8, 6, longSleeves ? 13 : 7, primary);
    g.rect(side < 0 ? x : x + 4, 8, 2, longSleeves ? 13 : 7, primaryShadow);
    if (!longSleeves) g.rect(x + 1, 15, 4, 6, skin);
    g.ellipse(x + 3, 23, 3.4, 3.6, skin);
    g.rect(side < 0 ? x : x + 4, 20, 2, 5, skinShadow);
  }

  // Torso
  g.ellipse(19, 17, 13.5, 13, primary, 3);
  g.rect(6, 17, 26, 11, primary);
  g.fill(primaryShadow, (x, y) => g.get(x, y) === primary && x >= 27 && y >= 9);
  g.rect(8, 26, 22, 3, shade(secondary, -0.35));
  g.rect(18, 26, 2, 3, accent);

  // Neck and collar
  g.rect(16, 0, 6, 5, skin);
  g.rect(16, 3, 6, 2, skinShadow);
  g.rect(14, 4, 10, 2, accent);

  // Outfit detail from the seed
  const detail = hash % 4;
  if (detail === 0) {
    g.rect(18, 6, 2, 20, accent);
  } else if (detail === 1) {
    g.rect(6, 14, 26, 2, accent);
    g.rect(6, 20, 26, 2, accent);
  } else if (detail === 2) {
    g.rect(22, 12, 6, 6, mixColors(primary, '#000000', 0.25));
    g.rect(22, 12, 6, 1, accent);
  } else {
    g.rect(13, 11, 4, 4, accent);
    g.rect(14, 12, 2, 2, shade(accent, 0.4));
  }

  g.recolor((x, y, current) => (current === primary && x < 9 && y > 8 && y < 24 && x > 5 ? shade(primary, 0.12) : undefined));

  g.outline(OUTLINE);
  return g;
}
