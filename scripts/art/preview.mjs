// Contact sheets to judge the head-on-body composition by eye.
//   node scripts/art/preview.mjs [scale]      (default x6)
// Writes art/preview/<professor>.png (one per professor: every skin with that professor's head,
// plus the hat when it exists), art/preview/overview.png (all of them, smaller) and
// art/preview/sceneries.png (every scenery at 480x270 with the default skin standing on it).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ASSETS_DIR, PREVIEW_DIR, ANCHORS_FILE, readJson } from './lib.mjs';

const SCALE = Number(process.argv[2]) || 6;
const BG = { r: 120, g: 128, b: 138, alpha: 1 };
const anchors = readJson(ANCHORS_FILE, {});
const PROFESSORS = ['edecio', 'gladimir', 'b2', 'wagner', 'guto', 'b1', 'angelo', 'pablo'];

const cache = new Map();
async function load(rel) {
  if (cache.has(rel)) return cache.get(rel);
  const file = path.join(ASSETS_DIR, `${rel}.png`);
  let v = null;
  if (fs.existsSync(file)) {
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    v = { rel, data, w: info.width, h: info.height, anchor: anchors[rel] || { x: info.width >> 1, y: info.height - 1 } };
  }
  cache.set(rel, v);
  return v;
}

function listSkins(prof) {
  const dir = path.join(ASSETS_DIR, 'skins');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.startsWith(prof + '-') && f.endsWith('.png')).map((f) => f.slice(0, -4))
    .sort((a, b) => (a.endsWith('-default') ? -1 : b.endsWith('-default') ? 1 : a.localeCompare(b)));
}

/** Compose body + head (+ hat) into one native-resolution RGBA canvas; returns {data,w,h}. */
async function compose(skinId, prof) {
  const skin = await load(`skins/${skinId}`);
  const head = await load(`heads/${prof}`);
  const hat = await load(`hats/${skinId}`);
  const layers = [{ img: skin, x: 0, y: 0 }];
  if (head) layers.push({ img: head, x: skin.anchor.x - head.anchor.x, y: skin.anchor.y - head.anchor.y });
  if (head && hat) {
    const hx = skin.anchor.x - head.anchor.x, hy = skin.anchor.y - head.anchor.y;
    // hat rests on the top of the head, a few px down into the hair
    layers.push({ img: hat, x: hx + (head.w >> 1) - hat.anchor.x, y: hy + 4 - hat.anchor.y });
  }
  let x0 = 0, y0 = 0, x1 = skin.w, y1 = skin.h;
  for (const l of layers) {
    x0 = Math.min(x0, l.x); y0 = Math.min(y0, l.y);
    x1 = Math.max(x1, l.x + l.img.w); y1 = Math.max(y1, l.y + l.img.h);
  }
  const w = x1 - x0, h = y1 - y0;
  const out = Buffer.alloc(w * h * 4);
  for (const l of layers) {
    for (let y = 0; y < l.img.h; y++) {
      for (let x = 0; x < l.img.w; x++) {
        const s = (y * l.img.w + x) * 4;
        if (l.img.data[s + 3] < 128) continue;
        const d = ((y + l.y - y0) * w + (x + l.x - x0)) * 4;
        out[d] = l.img.data[s]; out[d + 1] = l.img.data[s + 1]; out[d + 2] = l.img.data[s + 2]; out[d + 3] = 255;
      }
    }
  }
  return { data: out, w, h };
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
async function labelPng(text, width, height, size) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><text x="${width / 2}" y="${height * 0.72}" font-family="Verdana, Arial, sans-serif" font-size="${size}" fill="#101418" text-anchor="middle">${esc(text)}</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function sheetFor(prof, scale, outFile) {
  const skins = listSkins(prof);
  if (!skins.length) return null;
  const comps = [];
  for (const id of skins) comps.push({ id, c: await compose(id, prof) });
  const cw = Math.max(...comps.map((c) => c.c.w)), ch = Math.max(...comps.map((c) => c.c.h));
  const pad = 3, labelH = Math.max(14, Math.round(scale * 3));
  const cellW = (cw + pad * 2) * scale, cellH = ch * scale + labelH + pad * scale;
  const perRow = Math.min(skins.length, scale >= 5 ? 6 : 12);
  const rows = Math.ceil(skins.length / perRow);
  const W = cellW * perRow, H = cellH * rows;
  const layers = [];
  for (let k = 0; k < comps.length; k++) {
    const { id, c } = comps[k];
    const col = k % perRow, row = (k / perRow) | 0;
    const img = await sharp(c.data, { raw: { width: c.w, height: c.h, channels: 4 } })
      .resize(c.w * scale, c.h * scale, { kernel: 'nearest' }).png().toBuffer();
    // align feet at the bottom of the cell
    layers.push({ input: img, left: col * cellW + Math.round((cellW - c.w * scale) / 2), top: Math.round(row * cellH + (ch - c.h) * scale + pad * scale / 2) });
    layers.push({ input: await labelPng(id, cellW, labelH, Math.max(10, Math.round(scale * 1.7))), left: col * cellW, top: Math.round(row * cellH + ch * scale + pad * scale / 2) });
  }
  await sharp({ create: { width: W, height: H, channels: 4, background: BG } }).composite(layers).png().toFile(outFile);
  return { file: outFile, W, H };
}

async function sceneries() {
  const dir = path.join(ASSETS_DIR, 'sceneries');
  if (!fs.existsSync(dir)) return;
  const ids = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)).sort();
  if (!ids.length) return;
  const skinId = fs.existsSync(path.join(ASSETS_DIR, 'skins', 'edecio-default.png')) ? 'edecio-default' : null;
  const comp = skinId ? await compose(skinId, 'edecio') : null;
  const cols = 3, w = 480, h = 270, gap = 8, labelH = 22;
  const rows = Math.ceil(ids.length / cols);
  const layers = [];
  for (let k = 0; k < ids.length; k++) {
    const left = gap + (k % cols) * (w + gap), top = gap + ((k / cols) | 0) * (h + gap + labelH);
    layers.push({ input: path.join(dir, ids[k] + '.png'), left, top });
    if (comp) {
      const s = 2;
      const buf = await sharp(comp.data, { raw: { width: comp.w, height: comp.h, channels: 4 } })
        .resize(comp.w * s, comp.h * s, { kernel: 'nearest' }).png().toBuffer();
      layers.push({ input: buf, left: left + Math.round(w * 0.5 - comp.w), top: top + Math.round(h * 0.95 - comp.h * s) });
    }
    layers.push({ input: await labelPng(ids[k], w, labelH, 14), left, top: top + h });
  }
  const W = gap + cols * (w + gap), H = gap + rows * (h + gap + labelH);
  const file = path.join(PREVIEW_DIR, 'sceneries.png');
  await sharp({ create: { width: W, height: H, channels: 4, background: BG } }).composite(layers).png().toFile(file);
  console.log(`preview: ${path.relative(process.cwd(), file)}`);
}

async function main() {
  fs.mkdirSync(PREVIEW_DIR, { recursive: true });
  const done = [];
  for (const prof of PROFESSORS) {
    const r = await sheetFor(prof, SCALE, path.join(PREVIEW_DIR, `${prof}.png`));
    if (r) { done.push(prof); console.log(`preview: art/preview/${prof}.png (${r.W}x${r.H})`); }
  }
  // overview: all professors stacked at x3
  const parts = [];
  for (const prof of done) {
    const f = path.join(PREVIEW_DIR, `_ov-${prof}.png`);
    const r = await sheetFor(prof, 3, f);
    if (r) parts.push(r);
  }
  if (parts.length) {
    // grid of professor sheets (rows of professors would be far too tall)
    const cols = Math.min(parts.length, parts.some((p) => p.W > 600) ? 2 : 4);
    const cw = Math.max(...parts.map((p) => p.W)), ch = Math.max(...parts.map((p) => p.H));
    const rows = Math.ceil(parts.length / cols);
    const W = cw * cols, H = ch * rows;
    const layers = parts.map((p, k) => ({ input: p.file, left: (k % cols) * cw, top: ((k / cols) | 0) * ch }));
    await sharp({ create: { width: W, height: H, channels: 4, background: BG } }).composite(layers).png().toFile(path.join(PREVIEW_DIR, 'overview.png'));
    for (const p of parts) fs.unlinkSync(p.file);
    console.log(`preview: art/preview/overview.png (${W}x${H})`);
  }
  await sceneries();
}
main();
