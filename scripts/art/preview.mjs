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
  // A skin with headgear has its own head (the professor wearing it); otherwise the professor's plain head.
  const head = (await load(`heads/${skinId}`)) ?? (await load(`heads/${prof}`));
  const hat = await load(`hats/${skinId}`);
  const layers = [{ img: skin, x: 0, y: 0 }];
  if (head) layers.push({ img: head, x: skin.anchor.x - head.anchor.x, y: skin.anchor.y - head.anchor.y });
  if (head && hat) {
    const hx = skin.anchor.x - head.anchor.x, hy = skin.anchor.y - head.anchor.y;
    // hat rests on the top of the head, a few px down into the hair
    layers.push({ img: hat, x: hx + (head.w >> 1) - hat.anchor.x, y: hy + 4 - hat.anchor.y });
  }
  return flatten(layers, skin);
}

/** Flatten placed layers (the first one is the body) into one native-resolution RGBA canvas. */
function flatten(layers, skin) {
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
  await hackathon();
}

// ---------------------------------------------------------------- Hackathon contact sheets

const HK_HEADS = ['cacheado', 'oculos-redondos', 'topete', 'black-power', 'barba-ruiva', 'raspado', 'trancas', 'coque', 'franja-oculos', 'cabelo-rosa', 'cacho-longo', 'chanel'];
const HK_BODIES = ['estudante', 'estagiario'];
const HK_ENEMIES = ['bug', 'loop-infinito', 'vazamento-de-memoria', 'codigo-legado', 'conflito-de-merge', 'bug-de-merge', 'deploy-de-sexta'];
const HK_ITEMS = ['teclado-mecanico', 'notebook-velho', 'mouse-vertical', 'editor-escuro', 'terminal-hacker', 'calculadora-cientifica', 'cadeira-ergonomica', 'monitor-ultrawide', 'mesa-regulavel', 'luminaria-de-mesa', 'ventilador-de-mesa', 'nobreak', 'fone-cancelamento', 'mochila-de-notebook', 'cracha-do-hackathon', 'camiseta-do-evento', 'oculos-luz-azul', 'relogio-de-ponto', 'caneca-termica', 'pato-de-borracha', 'adesivo-de-linguagem', 'moeda-de-um-commit', 'trevo-de-quatro-folhas', 'suculenta-de-mesa'];

/** A student: a hackathon body with a hackathon head seated on the neck anchor. */
async function student(bodyId, headId) {
  const body = await load(`hackathon/bodies/${bodyId}`);
  const head = await load(`hackathon/heads/${headId}`);
  if (!body) return null;
  const layers = [{ img: body, x: 0, y: 0 }];
  if (head) layers.push({ img: head, x: body.anchor.x - head.anchor.x, y: body.anchor.y - head.anchor.y });
  return flatten(layers, body);
}

const asCanvas = (img) => ({ data: Buffer.from(img.data), w: img.w, h: img.h });

async function rawPng(c, scale) {
  return sharp(c.data, { raw: { width: c.w, height: c.h, channels: 4 } }).resize(c.w * scale, c.h * scale, { kernel: 'nearest' }).png().toBuffer();
}

/** Lay out {c, label}[] in a grid; sprites of a row share a bottom line. Writes the file. */
async function grid(cells, scale, perRow, file, labelPx = 12) {
  const pad = 8;
  const cw = Math.max(Math.max(...cells.map((x) => x.c.w)) * scale, labelPx * 11) + pad * 2, ch = Math.max(...cells.map((x) => x.c.h)) * scale;
  const labelH = labelPx + 10;
  const rows = Math.ceil(cells.length / perRow);
  const cellH = ch + labelH + pad;
  const layers = [];
  for (let k = 0; k < cells.length; k++) {
    const { c, label } = cells[k];
    const left = (k % perRow) * cw, top = ((k / perRow) | 0) * cellH;
    layers.push({ input: await rawPng(c, scale), left: left + Math.round((cw - c.w * scale) / 2), top: top + ch - c.h * scale + pad });
    layers.push({ input: await labelPng(label, cw, labelH, labelPx), left, top: top + ch + pad });
  }
  const W = cw * Math.min(perRow, cells.length), H = cellH * rows + pad;
  await sharp({ create: { width: W, height: H, channels: 4, background: BG } }).composite(layers).png().toFile(file);
  console.log(`preview: ${path.relative(process.cwd(), file)} (${W}x${H})`);
}

async function hackathon() {
  if (!fs.existsSync(path.join(ASSETS_DIR, 'hackathon'))) return;
  // 1) every head on each of the two bodies, x6 (one file per body)
  for (const body of HK_BODIES) {
    const cells = [];
    for (const head of HK_HEADS) {
      const c = await student(body, head);
      if (c) cells.push({ c, label: head });
    }
    if (cells.length) await grid(cells, SCALE, 6, path.join(PREVIEW_DIR, `hackathon-students-${body}.png`), 18);
  }
  const st = await student('estudante', 'cacheado');
  // 2) enemies side by side at x4, with a professor and a student for reference
  const cells = [];
  if (fs.existsSync(path.join(ASSETS_DIR, 'skins', 'edecio-default.png'))) cells.push({ c: await compose('edecio-default', 'edecio'), label: 'professor (ref)' });
  if (st) cells.push({ c: st, label: 'student (ref)' });
  for (const id of HK_ENEMIES) {
    const img = await load(`hackathon/enemies/${id}`);
    if (img) cells.push({ c: asCanvas(img), label: id });
  }
  if (cells.length > 2) await grid(cells, 4, 5, path.join(PREVIEW_DIR, 'hackathon-enemies.png'), 14);
  // 3) all item icons at x4 with their ids
  const items = [];
  for (const id of HK_ITEMS) {
    const img = await load(`hackathon/items/${id}`);
    if (img) items.push({ c: asCanvas(img), label: id });
  }
  if (items.length) await grid(items, 4, 6, path.join(PREVIEW_DIR, 'hackathon-items.png'), 14);
  // 4) the arena with a student, a common enemy and the boss standing on the floor, x2
  const arena = path.join(ASSETS_DIR, 'hackathon', 'arenas', 'capitulo-1.png');
  if (fs.existsSync(arena)) {
    const w = 480, h = 270, floorY = Math.round(h * 0.86);
    const layers = [{ input: arena, left: 0, top: 0 }];
    if (st) layers.push({ input: await rawPng(st, 1), left: Math.round(w * 0.2 - st.w / 2), top: floorY - st.h });
    for (const [id, cx] of [['bug', 0.48], ['deploy-de-sexta', 0.76]]) {
      const img = await load(`hackathon/enemies/${id}`);
      if (img) layers.push({ input: await rawPng(asCanvas(img), 1), left: Math.round(w * cx - img.w / 2), top: floorY - img.h });
    }
    const base = await sharp({ create: { width: w, height: h, channels: 4, background: BG } }).composite(layers).png().toBuffer();
    const file = path.join(PREVIEW_DIR, 'hackathon-arena.png');
    await sharp(base).resize(w * 2, h * 2, { kernel: 'nearest' }).png().toFile(file);
    console.log(`preview: ${path.relative(process.cwd(), file)}`);
  }
}
main();
