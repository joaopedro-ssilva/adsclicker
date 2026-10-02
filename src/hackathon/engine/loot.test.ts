import { describe, expect, it } from 'vitest';
import { itemScore, recycleValue, rerollAffix, rerollCost, rollDrops } from './index';
import type { Build, DropContext, ItemInstance } from './index';
import { rarityChances } from './loot';
import { mulberry32 } from './rng';
import { fixtureContent as content, stageOf, studentBuild } from './__fixtures__/content';
import { RARITIES } from '../content/types';
import type { ItemRarity } from '../content/types';

function context(over: Partial<DropContext> = {}, build: Build = studentBuild()): DropContext {
  let n = 0;
  return {
    stage: stageOf([['grunt']], { drops: ['ferr-a', 'setup-a', 'acc-a', 'amu-a'], level: 1 }),
    build,
    firstClear: false,
    pity: 0,
    rng: mulberry32(1),
    now: 1000,
    newId: () => `item-${(n += 1)}`,
    ...over,
  };
}

function rollMany(count: number, over: () => Partial<DropContext>, build?: Build): ItemInstance[] {
  const rng = mulberry32(99);
  const items: ItemInstance[] = [];
  for (let i = 0; i < count; i += 1) items.push(...rollDrops(context({ ...over(), rng }, build), content).items);
  return items;
}

const rankOf = (rarity: ItemRarity) => RARITIES.indexOf(rarity);

describe('rarity chances', () => {
  it('start from the weights', () => {
    const chances = rarityChances(0, content);
    expect(chances.map((c) => c.rarity)).toEqual([...RARITIES]);
    expect(chances[0]?.chance).toBeCloseTo(0.6, 3);
    expect(chances[4]?.chance).toBeCloseTo(0.007, 4);
  });

  it('never lower the chance of reaching a rarity when quality grows', () => {
    for (let quality = 0; quality < 500; quality += 7) {
      const now = rarityChances(quality, content);
      const next = rarityChances(quality + 7, content);
      for (let k = 1; k < RARITIES.length; k += 1) {
        const tail = (list: typeof now) => list.slice(k).reduce((s, c) => s + c.chance, 0);
        expect(tail(next)).toBeGreaterThanOrEqual(tail(now) - 1e-12);
      }
    }
  });
});

describe('rollDrops', () => {
  it('gives one item, sometimes two, and bosses two or three', () => {
    const counts = new Set<number>();
    const rng = mulberry32(5);
    for (let i = 0; i < 200; i += 1) counts.add(rollDrops(context({ rng }), content).items.length);
    expect([...counts].sort()).toEqual([1, 2]);
    const boss = rollDrops(context({ stage: stageOf([['boss']], { boss: true }) }), content);
    expect(boss.items.length).toBeGreaterThanOrEqual(2);
  });

  it('raises the extra-drop chance with Sorte and the dropExtra meta', () => {
    const share = (build: Build) => {
      const items = rollMany(2000, () => ({}), build);
      return items.length / 2000;
    };
    const base = studentBuild();
    const lucky = { ...studentBuild({ sorte: 40 }), meta: { ...base.meta, dropExtra: 20 } };
    expect(share(lucky)).toBeGreaterThan(share(base) + 0.15);
  });

  it('draws bases from the stage table and keeps the roll inside the ranges', () => {
    const items = rollMany(3000, () => ({ stage: stageOf([['grunt']], { drops: ['ferr-a', 'acc-a'], level: 1 }) }));
    expect(new Set(items.map((i) => i.base))).toEqual(new Set(['ferr-a', 'acc-a']));
    for (const item of items) {
      const base = content.items.find((b) => b.id === item.base);
      const rarity = content.rarities.find((r) => r.id === item.rarity);
      expect(item.affixes).toHaveLength(1 + (rarity?.extraAffixes ?? 0));
      expect(item.affixes[0]?.target).toBe(base?.primary.target);
      expect(new Set(item.affixes.map((a) => `${a.target}/${a.op}`)).size).toBe(item.affixes.length);
      for (const a of item.affixes) {
        expect(a.quality).toBeGreaterThanOrEqual(0);
        expect(a.quality).toBeLessThanOrEqual(100);
      }
      const primary = item.affixes[0];
      const mult = rarity?.valueMultiplier ?? 1;
      expect(primary?.value).toBeGreaterThanOrEqual(Math.round((base?.primary.min ?? 0) * mult * 10) / 10 - 0.1);
      expect(primary?.value).toBeLessThanOrEqual(Math.round((base?.primary.max ?? 0) * mult * 10) / 10 + 0.1);
      expect(item.quality).toBeGreaterThanOrEqual(0);
      expect(item.quality).toBeLessThanOrEqual(100);
    }
  });

  it('respects the rarity order of the weights', () => {
    const items = rollMany(20000, () => ({}));
    const counts = RARITIES.map((r) => items.filter((i) => i.rarity === r).length);
    for (let i = 1; i < counts.length; i += 1) expect(counts[i]).toBeLessThan(counts[i - 1] as number);
    expect(counts[4]).toBeGreaterThan(0);
  });

  it('shifts rarity upwards with luck, loot quality and a lucky day', () => {
    const rare = (items: ItemInstance[]) => items.filter((i) => rankOf(i.rarity) >= 2).length / items.length;
    const plain = rare(rollMany(10000, () => ({})));
    const lucky = rare(rollMany(10000, () => ({}), studentBuild({ sorte: 60 })));
    const meta = { ...studentBuild().meta, lootQuality: 60 };
    const quality = rare(rollMany(10000, () => ({}), { ...studentBuild(), meta }));
    const day = rare(
      rollMany(10000, () => ({ stage: stageOf([['grunt']], { drops: ['ferr-a'], modifiers: [{ id: 'l', name: 'l', description: '', lootQuality: 60 }] }) })),
    );
    expect(lucky).toBeGreaterThan(plain);
    expect(quality).toBeGreaterThan(plain);
    expect(day).toBeGreaterThan(plain);
  });

  it('scales values with the stage level', () => {
    const avg = (level: number) => {
      const items = rollMany(1000, () => ({ stage: stageOf([['grunt']], { drops: ['ferr-a'], level }) }));
      const common = items.filter((i) => i.rarity === 'comum');
      return common.reduce((s, i) => s + (i.affixes[0]?.value ?? 0), 0) / common.length;
    };
    expect(avg(6)).toBeGreaterThan(avg(1) * 1.3);
  });

  it('forces a legendary at the pity limit and resets the counter on any legendary', () => {
    const forced = rollDrops(context({ pity: 40, rng: mulberry32(3) }), content);
    expect(forced.items[0]?.rarity).toBe('lendario');
    expect(forced.pity).toBe(0);
    const before = rollDrops(context({ pity: 39, rng: () => 0 }), content);
    expect(before.items[0]?.rarity).toBe('comum');
    expect(before.pity).toBe(40);
    const natural = rollMany(30000, () => ({}));
    expect(natural.some((i) => i.rarity === 'lendario')).toBe(true);
  });

  it('guarantees the first clear at least the minimum rarity', () => {
    const rng = mulberry32(8);
    for (let i = 0; i < 300; i += 1) {
      const result = rollDrops(context({ firstClear: true, rng }), content);
      expect(rankOf(result.items[0]?.rarity ?? 'comum')).toBeGreaterThanOrEqual(rankOf('incomum'));
    }
  });

  it('is deterministic for a given rng and stamps ids and dates', () => {
    const a = rollDrops(context({ rng: mulberry32(4) }), content);
    const b = rollDrops(context({ rng: mulberry32(4) }), content);
    expect(a).toEqual(b);
    expect(a.items[0]).toMatchObject({ id: 'item-1', createdAt: 1000, rerolls: 0, level: 1 });
  });

  it('returns nothing when the stage has no known drops', () => {
    expect(rollDrops(context({ stage: stageOf([['grunt']], { drops: [] }) }), content).items).toEqual([]);
  });
});

describe('rerolls, recycling and score', () => {
  const sample = (): ItemInstance => {
    const rng = mulberry32(21);
    for (;;) {
      const item = rollDrops(context({ rng, firstClear: true, pity: 0 }), content).items.find((i) => i.rarity === 'raro' || i.rarity === 'epico');
      if (item) return item;
    }
  };

  it('rerolls a non-primary affix, keeping the others and avoiding repeats', () => {
    const item = sample();
    const next = rerollAffix(item, 1, mulberry32(2), content);
    expect(next.rerolls).toBe(1);
    expect(next.affixes[0]).toEqual(item.affixes[0]);
    expect(next.affixes.slice(2)).toEqual(item.affixes.slice(2));
    expect(new Set(next.affixes.map((a) => a.target)).size).toBe(next.affixes.length);
    expect(item.rerolls).toBe(0);
  });

  it('never rerolls the primary or an index that does not exist', () => {
    const item = sample();
    expect(rerollAffix(item, 0, mulberry32(2), content)).toEqual(item);
    expect(rerollAffix(item, 99, mulberry32(2), content)).toEqual(item);
  });

  it('doubles the price with each reroll', () => {
    const item = sample();
    expect(rerollCost(item, content)).toBe(50);
    expect(rerollCost({ ...item, rerolls: 3 }, content)).toBe(400);
  });

  it('recycles by rarity and ranks rarity first', () => {
    const make = (rarity: ItemRarity, quality: number, level = 1): ItemInstance => ({ ...sample(), rarity, quality, level });
    expect(recycleValue(make('raro', 10), content)).toBe(30);
    expect(itemScore(make('raro', 0), content)).toBeGreaterThan(itemScore(make('incomum', 100, 50), content));
    expect(itemScore(make('raro', 80), content)).toBeGreaterThan(itemScore(make('raro', 40, 50), content));
    expect(itemScore(make('raro', 40, 8), content)).toBeGreaterThan(itemScore(make('raro', 40, 2), content));
  });
});
