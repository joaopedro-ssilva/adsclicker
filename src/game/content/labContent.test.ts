import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { content } from './index';
import { labEnemies, labBossCycle, labEnemyFrom } from './labEnemies';
import { LAB_ADVANCED_FROM, labItems } from './labItems';

const PUBLIC = path.join(process.cwd(), 'public', 'assets');
const exists = (asset: string) => fs.existsSync(path.join(PUBLIC, `${asset}.png`));

describe('lab-only items', () => {
  it('are 6 per slot, with unique ids, a drop phase of the advanced tiers and valid effects', () => {
    expect(labItems).toHaveLength(24);
    for (const slot of ['ferramenta', 'setup', 'acessorio', 'amuleto']) expect(labItems.filter((base) => base.slot === slot), slot).toHaveLength(6);
    const ids = content.lab.bases.map((base) => base.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const base of labItems) {
      expect(base.fromPhase, base.id).toBeGreaterThanOrEqual(LAB_ADVANCED_FROM);
      expect(base.asset).toBe(`lab/items/${base.id}`);
      expect(base.description.length, base.id).toBeGreaterThan(20);
      expect(base.pool.length, base.id).toBeGreaterThanOrEqual(4);
      for (const def of [base.primary, ...base.pool]) {
        expect(content.lab.affixes[def.target], `${base.id} ${def.target}`).toBeDefined();
        expect(def.max).toBeGreaterThan(def.min);
      }
      if (base.unique.kind === 'skill') expect(content.lab.skillBonuses[base.unique.skill], base.id).toBeDefined();
      if (base.set) expect(content.lab.sets.some((set) => set.id === base.set), base.id).toBe(true);
    }
  });

  it('have their art on disk', () => {
    for (const base of labItems) expect(exists(base.asset), base.asset).toBe(true);
  });
});

describe('lab-only enemies', () => {
  it('are 5 regular ones with a phase and 2 bosses in the cycle, with unique ids and valid traits', () => {
    expect(labEnemies.filter((enemy) => !enemy.boss)).toHaveLength(5);
    expect(labEnemies.filter((enemy) => enemy.boss)).toHaveLength(2);
    const ids = content.lab.enemies.map((enemy) => enemy.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const enemy of labEnemies) {
      expect(enemy.asset).toBe(`lab/enemies/${enemy.id}`);
      expect(enemy.hp).toBeGreaterThan(0);
      for (const trait of enemy.traits) if (trait.kind === 'split') expect(ids).toContain(trait.into);
      if (enemy.boss) expect(labBossCycle).toContain(enemy.id);
      else expect(labEnemyFrom[enemy.id], enemy.id).toBeGreaterThanOrEqual(6);
    }
    expect(labBossCycle).toHaveLength(3);
    expect(labBossCycle[0]).toBe('deploy-de-sexta');
  });

  it('have their art on disk', () => {
    for (const enemy of labEnemies) expect(exists(enemy.asset), enemy.asset).toBe(true);
  });
});
