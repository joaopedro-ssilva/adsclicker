import { describe, expect, it } from 'vitest';
import type { BuildInput, ItemInstance, RolledAffix } from './index';
import { computeBuild } from './index';
import { fixtureContent as content } from './__fixtures__/content';

const affix = (target: RolledAffix['target'], value: number, op: RolledAffix['op'] = 'add'): RolledAffix => ({ target, op, value, quality: 50 });

function item(base: string, affixes: RolledAffix[], rarity: ItemInstance['rarity'] = 'comum'): ItemInstance {
  return { id: base, base, rarity, level: 1, affixes, quality: 50, rerolls: 0, createdAt: 0 };
}

const input = (over: Partial<BuildInput> = {}): BuildInput => ({
  cargo: 'estudante',
  level: 1,
  skillNodes: {},
  mentors: {},
  equipped: {},
  activeSkills: [],
  ...over,
});

describe('computeBuild', () => {
  it('starts from the base stats and grows per level', () => {
    expect(computeBuild(input(), content).stats).toEqual({ logica: 10, agilidade: 100, foco: 120, resiliencia: 0, atencao: 5, sorte: 0 });
    const level5 = computeBuild(input({ level: 5 }), content).stats;
    expect(level5.logica).toBe(18);
    expect(level5.foco).toBe(180);
  });

  it('sums add first, then pct', () => {
    const equipped = { ferramenta: item('ferr-b', [affix('logica', 10), affix('logica', 100, 'pct')]) };
    expect(computeBuild(input({ equipped }), content).stats.logica).toBe(40); // (10 + 10) * 2
  });

  it('counts skill nodes per level owned and mentors per level', () => {
    const build = computeBuild(input({ skillNodes: { logic: 3 }, mentors: { edecio: 2, gladimir: 1 } }), content);
    expect(build.stats.logica).toBe(10 + 6 + 2);
    expect(build.meta.dropExtra).toBe(5);
  });

  it('caps node and mentor levels at their maximum', () => {
    const build = computeBuild(input({ skillNodes: { logic: 50 }, mentors: { edecio: 50 } }), content);
    expect(build.stats.logica).toBe(10 + 10 + 3);
  });

  it('applies set bonuses at 2 and 4 pieces and scales them with setBonus', () => {
    const kit = (extra: RolledAffix[] = []) => ({
      ferramenta: item('ferr-a', []),
      setup: item('setup-a', []),
      acessorio: item('acc-a', []),
      amuleto: item('amu-a', extra),
    });
    const two = computeBuild(input({ equipped: { ferramenta: item('ferr-a', []), setup: item('setup-a', []) } }), content);
    expect(two.sets).toEqual({ kit: 2 });
    expect(two.stats.logica).toBe(20);
    const four = computeBuild(input({ equipped: kit() }), content);
    expect(four.sets).toEqual({ kit: 4 });
    expect(four.stats.foco).toBe(220);
    const boosted = computeBuild(input({ equipped: { ...kit(), amuleto: item('amu-a', [affix('setBonus', 100)]) } }), content);
    expect(boosted.stats.logica).toBe(30);
    expect(boosted.stats.foco).toBe(320);
    expect(computeBuild(input({ equipped: { ferramenta: item('ferr-a', []) } }), content).sets).toEqual({});
  });

  it('uses unique effects only from legendary items', () => {
    const common = computeBuild(input({ equipped: { setup: item('setup-b', []) } }), content);
    expect(common.uniques).toEqual([]);
    expect(common.stats.logica).toBe(10);
    const legendary = computeBuild(input({ equipped: { setup: item('setup-b', [], 'lendario') } }), content);
    expect(legendary.uniques).toHaveLength(1);
    expect(legendary.stats.logica).toBe(15); // +50%
  });

  it('keeps only chosen skills that an owned node unlocks, cut to the slots', () => {
    const nodes = { logic: 1, 'u-heal': 1, 'u-aoe': 1, 'u-block': 1 };
    const build = computeBuild(input({ skillNodes: nodes, activeSkills: ['heal', 'strike', 'aoe', 'block'] }), content);
    expect(build.skills).toEqual(['heal', 'aoe']);
  });

  it('adds skills granted by a legendary item without using a slot', () => {
    const nodes = { logic: 1, 'u-heal': 1, 'u-aoe': 1 };
    const build = computeBuild(
      input({ skillNodes: nodes, activeSkills: ['heal', 'aoe'], equipped: { setup: item('setup-a', [], 'lendario') } }),
      content,
    );
    expect(build.skills).toEqual(['heal', 'aoe', 'strike']);
  });

  it('clamps to sane bounds', () => {
    const wild = {
      ferramenta: item('ferr-b', [affix('atencao', 500), affix('agilidade', 5000), affix('cooldown', 500), affix('foco', -100000), affix('sorte', -5)]),
    };
    const build = computeBuild(input({ equipped: wild }), content);
    expect(build.stats.atencao).toBe(100);
    expect(build.stats.agilidade).toBe(500);
    expect(build.stats.foco).toBe(1);
    expect(build.stats.sorte).toBe(0);
    expect(build.meta.cooldown).toBe(80);
  });

  it('accepts negative percentages', () => {
    const equipped = { ferramenta: item('ferr-b', [affix('foco', -25, 'pct')]) };
    expect(computeBuild(input({ equipped }), content).stats.foco).toBe(90);
  });
});
