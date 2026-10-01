import { PixelGrid } from './pixelGrid';
import { hashSeed, mixColors, seededRandom, shade } from './procedural';

/** Same footprint and chin anchor as the real head sprites, so both can sit on the same body. */
export const PROCEDURAL_HEAD = { w: 47, h: 53, chin: { x: 23, y: 52 } } as const;

const SKIN_TONES = ['#f6d3b3', '#ecb98f', '#d99a6c', '#b87750', '#8d5a3c', '#fbe0c8'];
const HAIR_COLORS = ['#2a2230', '#4a3326', '#7a4a28', '#b5732f', '#d8b25c', '#8f9096', '#a3322e'];
const HAIR_STYLES = ['short', 'swoop', 'spiky', 'long', 'curly', 'bald', 'bun'] as const;
type HairStyle = (typeof HAIR_STYLES)[number];

const OUTLINE = '#1a1620';
const EYE = '#2a1f2d';
const FRAME = '#262838';
const CX = 23.5;

export function pickSkinTone(seed: string): string {
  return SKIN_TONES[hashSeed(`${seed}:skin`) % SKIN_TONES.length] ?? '#ecb98f';
}

function insideFace(x: number, y: number): boolean {
  return (Math.abs(x + 0.5 - CX) / 18.5) ** 2.3 + (Math.abs(y + 0.5 - 31) / 21.5) ** 2.3 <= 1;
}

function drawEyes(g: PixelGrid, hair: string, mood: number): void {
  for (const x of [13, 29]) {
    g.rect(x + 1, 28, 3, 1, EYE);
    g.rect(x, 29, 5, 5, EYE);
    g.rect(x + 1, 34, 3, 1, EYE);
    g.rect(x + 1, 29, 2, 2, '#ffffff');
    g.set(x + 3, 32, '#ffffff');
  }
  const brow = shade(hair, -0.2);
  const lift = mood % 2;
  g.rect(12, 24 - lift, 6, 2, brow);
  g.rect(29, 24, 6, 2, brow);
}

function drawGlasses(g: PixelGrid, skin: string): void {
  const lens = mixColors(skin, '#dff6ff', 0.4);
  for (const x of [9, 28]) {
    g.rect(x, 26, 11, 10, FRAME);
    g.rect(x + 1, 27, 9, 8, lens);
  }
  g.rect(20, 29, 8, 1, FRAME);
  g.rect(6, 29, 3, 1, FRAME);
  g.rect(39, 29, 3, 1, FRAME);
}

function drawMouth(g: PixelGrid, kind: number): void {
  const mouth = '#5b2a31';
  if (kind === 0) {
    // Open grin with teeth
    g.rect(18, 43, 11, 1, mouth);
    g.rect(19, 44, 9, 2, mouth);
    g.rect(20, 46, 7, 1, mouth);
    g.rect(19, 43, 9, 2, '#fff6e8');
    g.rect(22, 46, 3, 1, '#d9707a');
  } else if (kind === 1) {
    // Smile
    g.rect(17, 43, 2, 1, mouth);
    g.rect(28, 43, 2, 1, mouth);
    g.rect(19, 44, 9, 1, mouth);
  } else {
    // Smirk
    g.rect(19, 44, 8, 1, mouth);
    g.rect(27, 43, 3, 1, mouth);
  }
}

function drawHair(g: PixelGrid, style: HairStyle, hair: string, random: () => number): void {
  const wobble = Array.from({ length: g.width }, () => Math.floor(random() * 3));
  const inCap = (x: number, y: number) => (Math.abs(x + 0.5 - CX) / 22) ** 2.2 + (Math.abs(y + 0.5 - (style === 'bun' ? 22 : 21)) / 17.5) ** 2.2 <= 1;
  const side = (x: number) => Math.abs(x + 0.5 - CX) >= 15.5;

  if (style === 'bald') {
    g.fill(hair, (x, y) => inCap(x, y) && side(x + 1) && y >= 15 && y <= 29);
    return;
  }

  if (style === 'swoop') g.fill(hair, (x, y) => inCap(x, y) && (y <= 12 + (46 - x) * 0.28 || (side(x) && y <= 28)));
  else if (style === 'long') g.fill(hair, (x, y) => inCap(x, y) && y <= 13 + Math.abs(x + 0.5 - CX) * 0.35);
  else g.fill(hair, (x, y) => inCap(x, y) && (y <= 13 + (wobble[x] ?? 0) + (style === 'curly' ? 1 : 0) || (side(x) && y <= 28)));

  if (style === 'long') g.fill(hair, (x, y) => side(x) && y >= 14 && y <= 47 && (Math.abs(x + 0.5 - CX) / 23) ** 2.2 + (Math.abs(y + 0.5 - 29) / 23.5) ** 2.2 <= 1);

  if (style === 'spiky') {
    for (let spike = 0; spike < 6; spike += 1) {
      const baseX = 7 + spike * 6.6;
      const height = 5 + Math.floor(random() * 5);
      for (let row = 0; row < height; row += 1) {
        const half = Math.max(0, 3 - Math.floor((row * 3) / height));
        g.rect(Math.round(baseX - half), 4 - row + 1, half * 2 + 1, 1, hair);
      }
    }
  }

  if (style === 'curly') {
    for (let angle = 0; angle <= 12; angle += 1) {
      const t = Math.PI * (1 + angle / 12);
      g.ellipse(CX + Math.cos(t) * 20, 22 + Math.sin(t) * 17, 5 + (angle % 2), 5 + (angle % 2), hair);
    }
    g.fill(hair, (x, y) => y > 16 && y < 29 && side(x) && (Math.abs(x + 0.5 - CX) / 24) ** 2 + (Math.abs(y - 20) / 11) ** 2 <= 1);
  }

  if (style === 'bun') g.ellipse(CX, 4.5, 6, 4.5, hair);

  // Strand texture: light and dark diagonal streaks on the hair only.
  const light = shade(hair, 0.22);
  const dark = shade(hair, -0.2);
  g.recolor((x, y, current) => {
    if (current !== hair) return undefined;
    if ((x * 2 + y) % 11 < 2 && y < 18) return light;
    if ((x * 2 - y + 120) % 13 < 2) return dark;
    return undefined;
  });
}

/** A deterministic chibi head: skin tone, hair style and colour, glasses and beard all come from the seed. */
export function drawHead(seed: string, skin: string = pickSkinTone(seed)): PixelGrid {
  const g = new PixelGrid(PROCEDURAL_HEAD.w, PROCEDURAL_HEAD.h);
  const random = seededRandom(`${seed}:head`);
  const style = HAIR_STYLES[Math.floor(random() * HAIR_STYLES.length)] ?? 'short';
  const hair = HAIR_COLORS[Math.floor(random() * HAIR_COLORS.length)] ?? '#2a2230';
  const glasses = random() < 0.45;
  const beard = random() < 0.28 && style !== 'bun';
  const mouth = Math.floor(random() * 3);
  const mood = Math.floor(random() * 4);
  const skinShadow = shade(skin, -0.14);

  if (style === 'long') g.ellipse(CX, 29, 23, 23.5, hair, 2.2);

  g.ellipse(4.5, 33, 3.5, 4.5, skin);
  g.ellipse(42.5, 33, 3.5, 4.5, skin);
  g.rect(3, 32, 1, 3, skinShadow);
  g.rect(43, 32, 1, 3, skinShadow);
  g.fill(skin, insideFace);
  g.recolor((x, y, current) => (current === skin && (x - CX) * 0.55 + (y - 31) * 0.85 > 16 ? skinShadow : undefined));

  if (beard) {
    const facial = hair === '#d8b25c' ? shade(hair, -0.25) : hair;
    g.fill(facial, (x, y) => insideFace(x, y) && (y >= 41 || (y >= 30 && Math.abs(x + 0.5 - CX) >= 15)));
    g.rect(17, 38, 14, 2, facial);
  }

  const blush = mixColors(skin, '#ff6f7d', 0.4);
  g.ellipse(11.5, 39, 3.5, 2, blush);
  g.ellipse(35.5, 39, 3.5, 2, blush);
  g.rect(22, 37, 3, 2, skinShadow);
  g.set(23, 36, shade(skin, 0.18));

  drawMouth(g, mouth);
  drawEyes(g, hair, mood);
  if (glasses) drawGlasses(g, skin);
  drawHair(g, style, hair, random);

  g.outline(OUTLINE);
  return g;
}
