import type { SceneryDef } from '@/game/content/types';
import type { PixelPath } from './pixelGrid';
import { hashSeed, mixColors, seededRandom, shade } from './procedural';

/** Same size as the real scenery art, so real and procedural backdrops share one pixel size. */
export const SCENERY_SIZE = { w: 480, h: 270 } as const;

const HORIZON = 162;
const STYLES = ['skyline', 'hills', 'room'] as const;
type Style = (typeof STYLES)[number] | 'racks' | 'bars';

/** Known sceneries get a horizon that fits their theme; any other id picks one from its hash. */
const STYLE_BY_ID: Record<string, Style> = {
  academia: 'room',
  prisao: 'bars',
  'casa-automatica': 'room',
  arena: 'skyline',
  cidade: 'skyline',
  datacenter: 'racks',
  coordenacao: 'room',
  formatura: 'room',
  praia: 'hills',
  nether: 'hills',
  deserto: 'hills',
  templo: 'hills',
};
const BANDS = 12;

class RectBuffer {
  private readonly byColor = new Map<string, string[]>();

  rect(x: number, y: number, w: number, h: number, color: string): void {
    const commands = this.byColor.get(color) ?? [];
    commands.push(`M${x} ${y}h${w}v${h}h-${w}z`);
    this.byColor.set(color, commands);
  }

  paths(): PixelPath[] {
    return [...this.byColor].map(([color, commands]) => ({ color, d: commands.join('') }));
  }
}

function drawSky(out: RectBuffer, { sky, horizon }: SceneryDef['palette']): void {
  const colors = Array.from({ length: BANDS }, (_, index) => mixColors(sky, horizon, (index / (BANDS - 1)) ** 1.4));
  for (let band = 0; band < BANDS; band += 1) {
    const top = Math.round((band * HORIZON) / BANDS);
    const bottom = Math.round(((band + 1) * HORIZON) / BANDS);
    out.rect(0, top, SCENERY_SIZE.w, bottom - top, colors[band] ?? sky);
    const next = colors[band + 1];
    if (next) {
      // Dithered seam between two bands
      for (let row = 0; row < 2; row += 1) {
        for (let x = row * 2; x < SCENERY_SIZE.w; x += 4) out.rect(x, bottom - 4 + row * 2, 2, 2, next);
      }
    }
  }
}

function drawSkyline(out: RectBuffer, palette: SceneryDef['palette'], random: () => number): void {
  const far = mixColors(palette.horizon, palette.sky, 0.55);
  const near = mixColors(far, palette.floor, 0.45);
  const lit = mixColors(far, '#fff0b8', 0.55);
  for (const [color, minHeight, maxHeight, windows] of [
    [far, 40, 100, false],
    [near, 24, 62, true],
  ] as const) {
    let x = -10;
    while (x < SCENERY_SIZE.w) {
      const width = 20 + Math.floor(random() * 26);
      const height = minHeight + Math.floor(random() * (maxHeight - minHeight));
      out.rect(x, HORIZON - height, width, height, color);
      if (windows) {
        for (let wy = HORIZON - height + 6; wy < HORIZON - 8; wy += 9) {
          for (let wx = x + 5; wx < x + width - 6; wx += 8) if (random() < 0.3) out.rect(wx, wy, 3, 4, lit);
        }
      }
      x += width + Math.floor(random() * 6);
    }
  }
}

function drawHills(out: RectBuffer, palette: SceneryDef['palette'], random: () => number): void {
  const layers = [
    { color: mixColors(palette.horizon, palette.sky, 0.5), base: 62, swing: 34 },
    { color: mixColors(palette.horizon, palette.floor, 0.35), base: 34, swing: 24 },
  ];
  for (const { color, base, swing } of layers) {
    const phase = random() * 6;
    for (let x = 0; x < SCENERY_SIZE.w; x += 12) {
      const height = Math.round(base + Math.sin(x / 55 + phase) * swing * 0.5 + Math.sin(x / 23 + phase * 2) * swing * 0.25);
      out.rect(x, HORIZON - height, 12, height, color);
    }
  }
}

function drawRoom(out: RectBuffer, palette: SceneryDef['palette'], random: () => number): void {
  const wall = mixColors(palette.sky, palette.horizon, 0.5);
  const glass = shade(palette.sky, 0.12);
  out.rect(0, 30, SCENERY_SIZE.w, HORIZON - 30, wall);
  out.rect(0, HORIZON - 40, SCENERY_SIZE.w, 40, mixColors(wall, palette.floor, 0.3));
  out.rect(0, HORIZON - 42, SCENERY_SIZE.w, 3, shade(wall, 0.2));
  for (let x = 24; x < SCENERY_SIZE.w - 60; x += 118) {
    out.rect(x - 3, 46, 76, 70, shade(wall, -0.3));
    out.rect(x, 49, 70, 64, glass);
    out.rect(x + 33, 49, 4, 64, shade(wall, -0.3));
    out.rect(x, 79, 70, 4, shade(wall, -0.3));
    out.rect(x + 4, 53, 12, 20, shade(glass, 0.2));
  }
  for (let x = 90; x < SCENERY_SIZE.w - 60; x += 118) {
    const height = 20 + Math.floor(random() * 16);
    out.rect(x + 28, 56, 28, height, mixColors(palette.horizon, '#000000', 0.2));
    out.rect(x + 31, 59, 22, height - 6, shade(palette.horizon, 0.25));
  }
}

function drawRacks(out: RectBuffer, palette: SceneryDef['palette'], random: () => number): void {
  const wall = mixColors(palette.sky, palette.floor, 0.5);
  const rack = mixColors(palette.horizon, '#000000', 0.45);
  const led = ['#4cff8a', '#ffb347', '#5ec8ff'];
  out.rect(0, 20, SCENERY_SIZE.w, HORIZON - 20, wall);
  for (let x = 6; x < SCENERY_SIZE.w; x += 44) {
    out.rect(x, 34, 36, HORIZON - 34, rack);
    out.rect(x + 3, 38, 30, HORIZON - 44, shade(rack, 0.08));
    for (let y = 42; y < HORIZON - 12; y += 10) {
      out.rect(x + 6, y, 24, 6, shade(rack, -0.2));
      for (let lamp = 0; lamp < 3; lamp += 1) {
        if (random() < 0.7) out.rect(x + 8 + lamp * 5, y + 2, 2, 2, led[Math.floor(random() * led.length)] ?? '#4cff8a');
      }
    }
  }
}

function drawBars(out: RectBuffer, palette: SceneryDef['palette']): void {
  const wall = mixColors(palette.sky, palette.horizon, 0.6);
  const bar = mixColors(palette.horizon, '#000000', 0.5);
  out.rect(0, 0, SCENERY_SIZE.w, HORIZON, wall);
  out.rect(150, 40, 180, 90, shade(palette.sky, 0.18));
  for (let x = 150; x <= 326; x += 30) out.rect(x, 20, 6, 120, bar);
  out.rect(144, 70, 192, 6, bar);
  out.rect(144, 110, 192, 6, bar);
}

function drawFloor(out: RectBuffer, palette: SceneryDef['palette']): void {
  const { floor, horizon } = palette;
  const line = shade(floor, -0.2);
  const stripes = [0, 6, 14, 26, 42, 64, 92, 108];
  out.rect(0, HORIZON, SCENERY_SIZE.w, SCENERY_SIZE.h - HORIZON, floor);
  out.rect(0, HORIZON, SCENERY_SIZE.w, 4, mixColors(floor, horizon, 0.4));
  stripes.forEach((offset, index) => {
    const top = HORIZON + offset;
    const next = HORIZON + (stripes[index + 1] ?? SCENERY_SIZE.h - HORIZON);
    out.rect(0, top, SCENERY_SIZE.w, 2, line);
    const seam = 26 + index * 22;
    for (let x = index % 2 ? seam / 2 : 0; x < SCENERY_SIZE.w; x += seam) out.rect(Math.round(x), top + 2, 2, next - top - 2, line);
  });
  out.rect(0, SCENERY_SIZE.h - 14, SCENERY_SIZE.w, 14, shade(floor, -0.18));
}

/** A banded sky, one of three horizons (city, hills or room) and a perspective floor, all from the scenery palette. */
export function drawProceduralScenery(id: string, palette: SceneryDef['palette']): PixelPath[] {
  const out = new RectBuffer();
  const random = seededRandom(`${id}:scenery`);
  drawSky(out, palette);
  const style = STYLE_BY_ID[id] ?? STYLES[hashSeed(id) % STYLES.length];
  if (style === 'skyline') drawSkyline(out, palette, random);
  else if (style === 'hills') drawHills(out, palette, random);
  else if (style === 'racks') drawRacks(out, palette, random);
  else if (style === 'bars') drawBars(out, palette);
  else drawRoom(out, palette, random);
  drawFloor(out, palette);
  return out.paths();
}
