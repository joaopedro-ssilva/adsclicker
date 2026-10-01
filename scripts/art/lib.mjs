// Shared helpers for the art pipeline (paths, sheet spec, asset folders).
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const RAW_DIR = process.env.ART_RAW ? path.resolve(process.env.ART_RAW) : path.join(ROOT, 'art', 'raw');
export const ASSETS_DIR = process.env.ART_OUT ? path.resolve(process.env.ART_OUT) : path.join(ROOT, 'public', 'assets');
export const ANCHORS_FILE = process.env.ART_OUT ? path.join(path.resolve(process.env.ART_OUT), 'anchors.json') : path.join(ROOT, 'art', 'anchors.json');
export const SHEETS_FILE = process.env.ART_SHEETS ? path.resolve(process.env.ART_SHEETS) : path.join(ROOT, 'art', 'sheets.json');
export const PREVIEW_DIR = path.join(ROOT, 'art', 'preview');
export const MANIFEST_FILE = path.join(ROOT, 'src', 'ui', 'art', 'manifest.ts');

/** kind -> folder under public/assets */
export const KIND_FOLDER = {
  skin: 'skins',
  head: 'heads',
  hat: 'hats',
  scenery: 'sceneries',
  icon: 'icons',
};

export function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}
