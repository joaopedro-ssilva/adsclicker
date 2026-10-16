import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { labDecor, labStartItems } from './labCosmetics';
import { labSceneries } from './sceneries';
import { labSkins, skins } from './skins';
import { sceneries } from './sceneries';

const asset = (key: string) => fs.existsSync(path.join(process.cwd(), 'public', 'assets', `${key}.png`));

describe('content: Laboratório collection art', () => {
  it('has 18 skins with unique ids, a source marker and art on disk', () => {
    expect(labSkins).toHaveLength(18);
    const ids = labSkins.map((s) => s.id);
    // They are part of the main list now (113 = 95 + 18), each once.
    expect(skins).toHaveLength(113);
    expect(new Set(skins.map((s) => s.id)).size).toBe(skins.length);
    for (const id of ids) expect(skins.some((s) => s.id === id), id).toBe(true);
    for (const skin of labSkins) {
      expect(skin.id.startsWith(`${skin.professor}-`), skin.id).toBe(true);
      expect(skin.source, skin.id).toBeDefined();
      expect(asset(skin.body), skin.body).toBe(true);
      expect(skin.head && asset(skin.head), skin.id).toBe(true);
    }
    expect(labSkins.filter((s) => s.source === 'posdoc')).toHaveLength(8);
    expect(labSkins.filter((s) => s.source === 'donation')).toHaveLength(2);
  });

  it('has 6 sceneries with unique ids and art on disk', () => {
    expect(labSceneries).toHaveLength(6);
    // Part of the main list now (48 = 42 + 6), each once.
    expect(sceneries).toHaveLength(48);
    const ids = sceneries.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const scenery of labSceneries) expect(ids).toContain(scenery.id);
    for (const scenery of labSceneries) expect(asset(scenery.asset), scenery.id).toBe(true);
  });

  it('lists 12 decor objects and 6 starting items with art on disk', () => {
    expect(labDecor).toHaveLength(12);
    expect(labStartItems).toHaveLength(6);
    const all = [...labDecor, ...labStartItems];
    expect(new Set(all.map((i) => i.art)).size).toBe(all.length);
    for (const item of all) expect(asset(item.art), item.art).toBe(true);
  });
});
