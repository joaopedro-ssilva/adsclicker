// Turns raw Codex sheets (art/raw/*.png) into game-ready pixel-art sprites.
//
//   node scripts/art/process.mjs              process every sheet listed in art/sheets.json whose raw file exists
//   node scripts/art/process.mjs heads-1.png  process only the named raw file(s)
//
// Pipeline per sheet: background removal (transparent input or near-magenta fill, flood-fill from
// the borders + fringe cleanup) -> connected components -> N items left to right -> per item:
// detect the fake-pixel block size -> sample one dominant colour per block -> hard alpha -> anchor.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { RAW_DIR, ASSETS_DIR, ANCHORS_FILE, SHEETS_FILE, KIND_FOLDER, readJson, writeJson } from './lib.mjs';

/** Target native heights per kind (px). */
const TARGET_H = { skin: 48, head: 56 };
/** Icons: their longest side. */
const TARGET_MAX = { icon: 22 };
/** Hats are sized by width so they match the heads (head width is about 42-60 px). */
const TARGET_W = { hat: 52 };
const SCENERY_W = 480;
const SCENERY_H = 270;
const FLOOD_TOL = 70; // RGB distance to the border colour for the flood fill
const MIN_BLOCK = 4;
const MAX_BLOCK = 16;

// ---------------------------------------------------------------- image io

async function loadRGBA(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data), w: info.width, h: info.height };
}

// ---------------------------------------------------------- background removal

function median(arr) {
  const a = Array.from(arr).sort((x, y) => x - y);
  return a[a.length >> 1];
}

function isFringe(r, g, b) {
  // magenta blended with anything: both red and blue clearly above green, red ~ blue
  if (Math.min(r, b) - g > 55 && Math.abs(r - b) < 70) return true;
  // magenta blended into the dark outline: dark purple-ish
  return Math.min(r, b) >= 18 && Math.min(r, b) > 2.2 * g + 10 && Math.abs(r - b) < 0.5 * Math.max(r, b) + 10 && Math.max(r, b) < 130;
}
function isDark(r, g, b) {
  return Math.max(r, g, b) < 130;
}

/** Returns a Uint8Array mask (1 = sprite pixel). Also hardens the alpha of `img` in place. */
function removeBackground(img) {
  const { data, w, h } = img;
  const n = w * h;
  const mask = new Uint8Array(n).fill(1);

  // border statistics
  let transparentBorder = 0;
  let borderCount = 0;
  const br = [], bg = [], bb = [];
  const visitBorder = (x, y) => {
    const i = (y * w + x) * 4;
    borderCount++;
    if (data[i + 3] < 128) transparentBorder++;
    else {
      br.push(data[i]);
      bg.push(data[i + 1]);
      bb.push(data[i + 2]);
    }
  };
  for (let x = 0; x < w; x++) {
    visitBorder(x, 0);
    visitBorder(x, h - 1);
  }
  for (let y = 1; y < h - 1; y++) {
    visitBorder(0, y);
    visitBorder(w - 1, y);
  }
  const transparentInput = transparentBorder > borderCount * 0.5;

  // 1) already-transparent pixels are background
  for (let p = 0; p < n; p++) if (data[p * 4 + 3] < 128) mask[p] = 0;

  // 2) flood fill from the borders over pixels close to the border colour
  let bgColor = null;
  if (!transparentInput && br.length) {
    bgColor = [median(br), median(bg), median(bb)];
    const close = (p) => {
      const i = p * 4;
      const dr = data[i] - bgColor[0], dg = data[i + 1] - bgColor[1], db = data[i + 2] - bgColor[2];
      return Math.sqrt(dr * dr + dg * dg + db * db) < FLOOD_TOL;
    };
    const stack = [];
    const push = (p) => {
      if (mask[p] && close(p)) {
        mask[p] = 0;
        stack.push(p);
      }
    };
    for (let x = 0; x < w; x++) {
      push(x);
      push((h - 1) * w + x);
    }
    for (let y = 0; y < h; y++) {
      push(y * w);
      push(y * w + w - 1);
    }
    while (stack.length) {
      const p = stack.pop();
      const x = p % w, y = (p / w) | 0;
      if (x > 0) push(p - 1);
      if (x < w - 1) push(p + 1);
      if (y > 0) push(p - w);
      if (y < h - 1) push(p + w);
    }

    // 3) enclosed pockets of (tightly) background-coloured pixels, e.g. between an arm and the body
    const tight = (p) => {
      const i = p * 4;
      const dr = data[i] - bgColor[0], dg = data[i + 1] - bgColor[1], db = data[i + 2] - bgColor[2];
      return Math.sqrt(dr * dr + dg * dg + db * db) < 40;
    };
    const seen = new Uint8Array(n);
    for (let p = 0; p < n; p++) {
      if (!mask[p] || seen[p] || !tight(p)) continue;
      const comp = [p];
      seen[p] = 1;
      for (let k = 0; k < comp.length; k++) {
        const q = comp[k];
        const x = q % w, y = (q / w) | 0;
        const nb = [];
        if (x > 0) nb.push(q - 1);
        if (x < w - 1) nb.push(q + 1);
        if (y > 0) nb.push(q - w);
        if (y < h - 1) nb.push(q + w);
        for (const m of nb) if (mask[m] && !seen[m] && tight(m)) {
          seen[m] = 1;
          comp.push(m);
        }
      }
      if (comp.length >= 30) for (const q of comp) mask[q] = 0;
    }
  }

  // 4) fringe cleanup: magenta-ish pixels touching the background, a few passes
  for (let pass = 0; pass < 8; pass++) {
    const kill = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (!mask[p]) continue;
        const i = p * 4;
        if (!isFringe(data[i], data[i + 1], data[i + 2])) continue;
        const edge =
          x === 0 || y === 0 || x === w - 1 || y === h - 1 ||
          !mask[p - 1] || !mask[p + 1] || !mask[p - w] || !mask[p + w];
        if (edge) kill.push(p);
      }
    }
    if (!kill.length) break;
    for (const p of kill) mask[p] = 0;
  }
  return mask;
}

// ------------------------------------------------------------ components

function components(mask, w, h) {
  const label = new Int32Array(w * h).fill(-1);
  const comps = [];
  const stack = [];
  for (let s = 0; s < w * h; s++) {
    if (!mask[s] || label[s] >= 0) continue;
    const id = comps.length;
    const c = { id, area: 0, x0: w, y0: h, x1: -1, y1: -1, px: [] };
    label[s] = id;
    stack.push(s);
    while (stack.length) {
      const p = stack.pop();
      const x = p % w, y = (p / w) | 0;
      c.area++;
      c.px.push(p);
      if (x < c.x0) c.x0 = x;
      if (x > c.x1) c.x1 = x;
      if (y < c.y0) c.y0 = y;
      if (y > c.y1) c.y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (mask[q] && label[q] < 0) {
            label[q] = id;
            stack.push(q);
          }
        }
      }
    }
    comps.push(c);
  }
  return comps;
}

function bboxGap(a, b) {
  const dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1);
  const dy = Math.max(0, a.y0 - b.y1, b.y0 - a.y1);
  return Math.hypot(dx, dy);
}

/** Pick `count` items out of the components, merging fragments, sorted left to right. */
function splitItems(comps, count, w, name) {
  const speck = 40;
  const sorted = [...comps].sort((a, b) => b.area - a.area);
  if (sorted.length < count) {
    throw new Error(`${name}: expected ${count} items but found only ${sorted.length} connected shape(s) (items touching?)`);
  }
  const seeds = sorted.slice(0, count);
  const areas = seeds.map((s) => s.area).sort((a, b) => a - b);
  const med = areas[areas.length >> 1];
  if (areas[0] < med * 0.1) {
    throw new Error(`${name}: item areas look wrong (smallest ${areas[0]} vs median ${med}); wrong count or a fragmented item`);
  }
  const groups = seeds.map((s) => ({ ...s, px: s.px.slice() }));
  for (const frag of sorted.slice(count)) {
    if (frag.area < speck) continue;
    let best = null, bestGap = Infinity;
    for (const g of groups) {
      const gap = bboxGap(frag, g);
      if (gap < bestGap) {
        bestGap = gap;
        best = g;
      }
    }
    if (best && bestGap < w * 0.12) {
      for (const p of frag.px) best.px.push(p);
      best.x0 = Math.min(best.x0, frag.x0);
      best.y0 = Math.min(best.y0, frag.y0);
      best.x1 = Math.max(best.x1, frag.x1);
      best.y1 = Math.max(best.y1, frag.y1);
      best.area += frag.area;
    }
  }
  groups.sort((a, b) => (a.x0 + a.x1) - (b.x0 + b.x1));
  return groups;
}

function cropItem(img, group) {
  const { w } = img;
  const cw = group.x1 - group.x0 + 1;
  const ch = group.y1 - group.y0 + 1;
  const data = new Uint8ClampedArray(cw * ch * 4);
  for (const p of group.px) {
    const x = p % w - group.x0, y = ((p / w) | 0) - group.y0;
    const o = (y * cw + x) * 4;
    const i = p * 4;
    data[o] = img.data[i];
    data[o + 1] = img.data[i + 1];
    data[o + 2] = img.data[i + 2];
    data[o + 3] = 255;
  }
  return { data, w: cw, h: ch };
}

// ------------------------------------------------------- block detection

/** Edge strength between adjacent columns (axis 'x') or rows (axis 'y'). */
function edgeProfile(img, axis) {
  const { data, w, h } = img;
  const len = axis === 'x' ? w : h;
  const prof = new Float64Array(len);
  const diff = (i, j) =>
    Math.abs(data[i] - data[j]) + Math.abs(data[i + 1] - data[j + 1]) + Math.abs(data[i + 2] - data[j + 2]) +
    Math.abs(data[i + 3] - data[j + 3]);
  if (axis === 'x') {
    for (let x = 1; x < w; x++) for (let y = 0; y < h; y++) prof[x] += diff((y * w + x) * 4, (y * w + x - 1) * 4);
  } else {
    for (let y = 1; y < h; y++) for (let x = 0; x < w; x++) prof[y] += diff((y * w + x) * 4, ((y - 1) * w + x) * 4);
  }
  return prof;
}

function bestGrid(prof, lo = MIN_BLOCK, hi = MAX_BLOCK) {
  const len = prof.length;
  let total = 0;
  for (let i = 1; i < len; i++) total += prof[i];
  const mean = total / Math.max(1, len - 1) + 1e-9;
  const cands = [];
  for (let p = lo; p <= hi + 1e-9; p += 0.05) {
    let best = { score: -1, phase: 0 };
    for (let phase = 0; phase < p; phase += 0.5) {
      let sum = 0, cnt = 0;
      for (let pos = phase; pos < len - 1; pos += p) {
        const c = Math.round(pos);
        let m = 0;
        for (let d = -1; d <= 1; d++) if (c + d >= 1 && c + d < len) m = Math.max(m, prof[c + d]);
        sum += m;
        cnt++;
      }
      if (cnt < 4) continue;
      const score = sum / cnt / mean;
      if (score > best.score) best = { score, phase };
    }
    if (best.score >= 0) cands.push({ p, ...best });
  }
  if (!cands.length) return null;
  const top = Math.max(...cands.map((c) => c.score));
  // among near-best candidates take the smallest block (the range is already limited to +-25% of the
  // expected size, so multiples of the true size are out of reach)
  const pick = cands.find((c) => c.score >= top * 0.97);
  return { ...pick, top };
}

/** Decide the block size (px per art pixel) for an item. */
function detectBlock(item, target, name) {
  const dim = target.axis === 'w' ? item.w : target.axis === 'max' ? Math.max(item.w, item.h) : item.h;
  const targetH = target.size;
  const tb0 = dim / targetH;
  const lo = Math.max(MIN_BLOCK, tb0 * 0.6), hi = Math.min(MAX_BLOCK, tb0 * 1.4);
  const gx = bestGrid(edgeProfile(item, 'x'), lo, hi);
  const gy = bestGrid(edgeProfile(item, 'y'), lo, hi);
  let b = null, px = 0, py = 0, why = '';
  if (gx && gy && Math.abs(gx.p - gy.p) / Math.max(gx.p, gy.p) < 0.12) {
    b = (gx.p + gy.p) / 2;
    px = gx.phase;
    py = gy.phase;
    why = `grid x=${gx.p.toFixed(2)} y=${gy.p.toFixed(2)}`;
  } else if (gx || gy) {
    const g = gx && gy ? (gx.top > gy.top ? gx : gy) : gx || gy;
    b = g.p;
    why = `grid single-axis ${g.p.toFixed(2)}`;
  }
  const tb = dim / targetH;
  if (b === null || dim / b < targetH * 0.88 || dim / b > targetH * 1.12) {
    // detection missing or far from the target resolution: resample straight to the target height
    why = `target (detected ${b ? b.toFixed(2) : 'none'} -> ${b ? (dim / b).toFixed(0) : '?'}px ${target.axis})`;
    b = tb;
    px = py = 0;
  }
  console.log(`    ${name}: block ${b.toFixed(2)} [${why}] scores ${gx ? gx.top.toFixed(2) : '-'}/${gy ? gy.top.toFixed(2) : '-'}`);
  return { b, px, py };
}

// ----------------------------------------------------------- resampling

/** Sample one dominant colour per block. Returns {data,w,h} with hard alpha. */
function blockSample(img, b, px, py, opts = {}) {
  const { data, w, h } = img;
  const opaqueAll = opts.opaque === true;
  const sx = px - b * Math.ceil(px / b - 1e-9);
  const sy = py - b * Math.ceil(py / b - 1e-9);
  const cols = Math.max(1, Math.round((w - sx) / b));
  const rows = Math.max(1, Math.round((h - sy) / b));
  const out = new Uint8ClampedArray(cols * rows * 4);
  const inner = 0.25;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      let x0 = Math.round(sx + (i + inner) * b);
      let x1 = Math.round(sx + (i + 1 - inner) * b);
      let y0 = Math.round(sy + (j + inner) * b);
      let y1 = Math.round(sy + (j + 1 - inner) * b);
      if (x1 <= x0) x1 = x0 + 1;
      if (y1 <= y0) y1 = y0 + 1;
      x0 = Math.max(0, x0); y0 = Math.max(0, y0);
      x1 = Math.min(w, x1); y1 = Math.min(h, y1);
      if (x1 <= x0 || y1 <= y0) continue;
      let total = 0, opaque = 0;
      const buckets = new Map();
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const o = (y * w + x) * 4;
          total++;
          if (data[o + 3] < 128) continue;
          opaque++;
          const key = ((data[o] >> 4) << 8) | ((data[o + 1] >> 4) << 4) | (data[o + 2] >> 4);
          let e = buckets.get(key);
          if (!e) buckets.set(key, (e = { n: 0, r: 0, g: 0, b: 0 }));
          e.n++; e.r += data[o]; e.g += data[o + 1]; e.b += data[o + 2];
        }
      }
      if (!opaqueAll && opaque < total * 0.5) continue;
      if (!opaque) continue;
      let best = null;
      for (const e of buckets.values()) if (!best || e.n > best.n) best = e;
      const o = (j * cols + i) * 4;
      out[o] = Math.round(best.r / best.n);
      out[o + 1] = Math.round(best.g / best.n);
      out[o + 2] = Math.round(best.b / best.n);
      out[o + 3] = 255;
    }
  }
  return { data: out, w: cols, h: rows };
}

/** Remove magenta-blend pixels left along the sprite silhouette (after block sampling). */
function removeFringe(img) {
  const { data, w, h } = img;
  const a = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? data[(y * w + x) * 4 + 3] : 0);
  for (let pass = 0; pass < 3; pass++) {
    const kill = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (!data[i + 3] || !isFringe(data[i], data[i + 1], data[i + 2])) continue;
        let open = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && !a(x + dx, y + dy)) open++;
        if (open) kill.push(i);
      }
    }
    if (!kill.length) break;
    // dark blends become plain outline colour (keeps the outline closed), bright ones are dropped
    for (const i of kill) {
      if (isDark(data[i], data[i + 1], data[i + 2])) {
        data[i] = 22; data[i + 1] = 12; data[i + 2] = 14;
      } else data[i + 3] = 0;
    }
  }
}

function removeIsolated(img) {
  const { data, w, h } = img;
  const a = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? data[(y * w + x) * 4 + 3] : 0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (a(x, y) && !a(x - 1, y) && !a(x + 1, y) && !a(x, y - 1) && !a(x, y + 1)) data[(y * w + x) * 4 + 3] = 0;
    }
  }
}

function trim(img) {
  const { data, w, h } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error('empty sprite after processing');
  const nw = x1 - x0 + 1, nh = y1 - y0 + 1;
  const out = new Uint8ClampedArray(nw * nh * 4);
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const s = ((y + y0) * w + x + x0) * 4, d = (y * nw + x) * 4;
      for (let k = 0; k < 4; k++) out[d + k] = data[s + k];
    }
  }
  return { data: out, w: nw, h: nh };
}

// -------------------------------------------------------------- anchors

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  const d = mx - mn;
  let hh = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (mx === r) hh = ((g - b) / d + 6) % 6;
    else if (mx === g) hh = (b - r) / d + 2;
    else hh = (r - g) / d + 4;
    hh *= 60;
  }
  return { h: hh, s, l };
}

function isSkin(data, i) {
  if (data[i + 3] < 128) return false;
  const { h, s, l } = rgbToHsl(data[i], data[i + 1], data[i + 2]);
  return h >= 8 && h <= 45 && s >= 0.25 && s <= 1.01 && l >= 0.5 && l <= 0.92;
}

function skinAnchor(img) {
  const { data, w, h } = img;
  // topmost row (within the top 35%) holding a run of >= 3 skin pixels = neck stub top
  const limit = Math.max(4, Math.round(h * 0.35));
  for (let y = 0; y < limit; y++) {
    const xs = [];
    for (let x = 0; x < w; x++) if (isSkin(data, (y * w + x) * 4)) xs.push(x);
    if (xs.length >= 3) {
      // keep the widest contiguous run near the horizontal middle
      const runs = [];
      let cur = [xs[0]];
      for (let k = 1; k < xs.length; k++) {
        if (xs[k] === xs[k - 1] + 1) cur.push(xs[k]);
        else { runs.push(cur); cur = [xs[k]]; }
      }
      runs.push(cur);
      const run = runs.filter((r) => r.length >= 3).sort((a, b) => b.length - a.length)[0];
      if (run) return { x: Math.round((run[0] + run[run.length - 1]) / 2), y: y + 1, method: 'skin' };
    }
  }
  // fallback: centre of the topmost opaque row
  for (let y = 0; y < h; y++) {
    const xs = [];
    for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3]) xs.push(x);
    if (xs.length) return { x: Math.round((xs[0] + xs[xs.length - 1]) / 2), y: y + 1, method: 'top-row' };
  }
  return { x: w >> 1, y: 1, method: 'none' };
}

function headAnchor(img) {
  const { data, w, h } = img;
  // x: middle of the sprite; y: lowest opaque pixel in the central column band (chin or beard tip),
  // so long hair falling past the chin does not drag the anchor down
  const cx = (w - 1) / 2;
  const band = Math.max(2, Math.round(w * 0.1));
  let yb = h - 1;
  for (let y = h - 1; y >= 0; y--) {
    let hit = false;
    for (let x = Math.round(cx - band); x <= Math.round(cx + band); x++) {
      if (x >= 0 && x < w && data[(y * w + x) * 4 + 3]) hit = true;
    }
    if (hit) { yb = y; break; }
  }
  return { x: Math.round(cx), y: yb };
}

function hatAnchor(img) {
  return { x: Math.round((img.w - 1) / 2), y: img.h - 1 };
}

// ------------------------------------------------------------------ main

async function savePng(img, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength), {
    raw: { width: img.w, height: img.h, channels: 4 },
  }).png({ compressionLevel: 9 }).toFile(file);
}

async function processScenery(sheet, anchors) {
  const key = sheet.keys[0];
  const raw = await loadRGBA(path.join(RAW_DIR, sheet.file));
  // cover-crop to 16:9
  const targetRatio = SCENERY_W / SCENERY_H;
  let cw = raw.w, ch = raw.h;
  if (raw.w / raw.h > targetRatio) cw = Math.round(raw.h * targetRatio);
  else ch = Math.round(raw.w / targetRatio);
  const ox = (raw.w - cw) >> 1, oy = (raw.h - ch) >> 1;
  const crop = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const s = ((y + oy) * raw.w + x + ox) * 4, d = (y * cw + x) * 4;
      crop[d] = raw.data[s]; crop[d + 1] = raw.data[s + 1]; crop[d + 2] = raw.data[s + 2]; crop[d + 3] = 255;
    }
  }
  const b = cw / SCENERY_W;
  const out = blockSample({ data: crop, w: cw, h: ch }, b, 0, 0, { opaque: true });
  const fixed = await sharp(Buffer.from(out.data.buffer), { raw: { width: out.w, height: out.h, channels: 4 } })
    .resize(SCENERY_W, SCENERY_H, { kernel: 'nearest', fit: 'fill' }).raw().toBuffer();
  const img = { data: new Uint8ClampedArray(fixed), w: SCENERY_W, h: SCENERY_H };
  const rel = `${KIND_FOLDER.scenery}/${key}`;
  await savePng(img, path.join(ASSETS_DIR, `${rel}.png`));
  delete anchors[rel];
  console.log(`  ${rel}  ${img.w}x${img.h}  (raw ${raw.w}x${raw.h}, block ${b.toFixed(2)})`);
}

async function processSheet(sheet, anchors) {
  console.log(`${sheet.file} [${sheet.kind}] -> ${sheet.keys.join(', ')}`);
  if (sheet.kind === 'scenery') return processScenery(sheet, anchors);
  const img = await loadRGBA(path.join(RAW_DIR, sheet.file));
  const mask = removeBackground(img);
  const comps = components(mask, img.w, img.h);
  // `img.data` keeps raw colours; the mask decides which pixels belong to sprites
  const groups = splitItems(comps, sheet.keys.length, img.w, sheet.file);
  const folder = KIND_FOLDER[sheet.kind];
  for (let k = 0; k < groups.length; k++) {
    const key = sheet.keys[k];
    const item = cropItem(img, groups[k]);
    const { b, px, py } = detectBlock(item, TARGET_W[sheet.kind] ? { axis: 'w', size: TARGET_W[sheet.kind] } : TARGET_MAX[sheet.kind] ? { axis: 'max', size: TARGET_MAX[sheet.kind] } : { axis: 'h', size: TARGET_H[sheet.kind] }, key);
    let sprite = blockSample(item, b, px, py);
    removeFringe(sprite);
    removeIsolated(sprite);
    sprite = trim(sprite);
    let anchor;
    if (sheet.kind === 'skin') anchor = skinAnchor(sprite);
    else if (sheet.kind === 'head') anchor = headAnchor(sprite);
    else if (sheet.kind === 'hat') anchor = hatAnchor(sprite);
    const rel = `${folder}/${key}`;
    await savePng(sprite, path.join(ASSETS_DIR, `${rel}.png`));
    if (anchor) anchors[rel] = { x: anchor.x, y: anchor.y };
    else delete anchors[rel];
    console.log(`  ${rel}  ${sprite.w}x${sprite.h}${anchor ? `  anchor ${anchor.x},${anchor.y}${anchor.method ? ' (' + anchor.method + ')' : ''}` : ''}`);
  }
}

async function main() {
  const spec = readJson(SHEETS_FILE, { sheets: [] });
  const only = process.argv.slice(2).map((s) => path.basename(s));
  const anchors = readJson(ANCHORS_FILE, {});
  let failed = 0;
  for (const sheet of spec.sheets) {
    if (only.length && !only.includes(sheet.file)) continue;
    if (!fs.existsSync(path.join(RAW_DIR, sheet.file))) {
      if (only.length) console.error(`missing raw file ${sheet.file}`);
      continue;
    }
    try {
      await processSheet(sheet, anchors);
    } catch (e) {
      failed++;
      console.error(`FAILED ${sheet.file}: ${e.message}`);
    }
  }
  writeJson(ANCHORS_FILE, Object.fromEntries(Object.entries(anchors).sort(([a], [b]) => a.localeCompare(b))));
  if (failed) process.exitCode = 1;
}

main();
