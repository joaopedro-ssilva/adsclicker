import { describe, expect, it } from 'vitest';
import { PROFESSOR_IDS } from '@/game/content/index';
import { hackathonContent as c } from './index';
import type { Modifier, SkillNodeDef, UniqueEffect } from './index';
import { RARITIES, SLOT_IDS, STAT_IDS } from './types';

const ids = (list: { id: string }[]): string[] => list.map((entry) => entry.id);
const duplicates = (list: string[]): string[] => list.filter((entry, index) => list.indexOf(entry) !== index);

const META_IDS = [
  'dropExtra',
  'lootQuality',
  'commitsGain',
  'xpGain',
  'setBonus',
  'bossDamage',
  'skillPower',
  'cooldown',
];
const VALID_TARGETS: string[] = [...STAT_IDS, ...META_IDS];

const itemIds = ids(c.items);
const enemyIds = ids(c.enemies);
const skillIds = ids(c.skills);
const nodeIds = ids(c.skillNodes);
const stageIds = ids(c.stages);
const setIds = ids(c.sets);

const modifiersOf = (unique: UniqueEffect): Modifier[] => (unique.kind === 'modifiers' ? unique.modifiers : []);

describe('hackathon content: ids and quantities', () => {
  it('has unique ids in every kind', () => {
    for (const list of [
      c.cargos,
      c.heads,
      c.skillNodes,
      c.skills,
      c.items,
      c.sets,
      c.rarities,
      c.enemies,
      c.waveBuffs,
      c.stages,
      c.dailyModifiers,
    ]) {
      expect(duplicates(ids(list))).toEqual([]);
    }
    expect(duplicates(c.mentors.map((mentor) => mentor.professor))).toEqual([]);
  });

  it('has the quantities of the first-version scope table', () => {
    expect(c.cargos).toHaveLength(2);
    expect(c.heads).toHaveLength(12);
    expect(c.skills).toHaveLength(4);
    expect(c.skillNodes).toHaveLength(12);
    expect(c.mentors).toHaveLength(8);
    expect(c.items).toHaveLength(24);
    expect(c.sets).toHaveLength(1);
    expect(c.rarities).toHaveLength(5);
    expect(c.enemies.filter((enemy) => enemy.boss)).toHaveLength(1);
    expect(c.enemies.filter((enemy) => !enemy.boss)).toHaveLength(6);
    expect(c.waveBuffs).toHaveLength(12);
    expect(c.stages).toHaveLength(9);
    expect(c.dailyModifiers).toHaveLength(8);
  });

  it('has 6 bases per slot', () => {
    for (const slot of SLOT_IDS) expect(c.items.filter((item) => item.slot === slot), slot).toHaveLength(6);
  });
});

describe('hackathon content: references', () => {
  it('points stage waves, drops and requirements at things that exist', () => {
    for (const stage of c.stages) {
      for (const wave of stage.waves) for (const enemy of wave) expect(enemyIds, `${stage.id} wave`).toContain(enemy);
      for (const drop of stage.drops) expect(itemIds, `${stage.id} drop`).toContain(drop);
      if (stage.requires !== null) expect(stageIds, `${stage.id} requires`).toContain(stage.requires);
      expect(stage.drops.length).toBeGreaterThanOrEqual(3);
      expect(stage.drops.length).toBeLessThanOrEqual(4);
      expect(duplicates(stage.drops)).toEqual([]);
      expect(stage.waves.length).toBeGreaterThanOrEqual(3);
      expect(stage.waves.length).toBeLessThanOrEqual(5);
      for (const wave of stage.waves) {
        expect(wave.length).toBeGreaterThanOrEqual(1);
        expect(wave.length).toBeLessThanOrEqual(3);
      }
    }
  });

  it('points cargo promotions, node unlocks, uniques, sets and splits at things that exist', () => {
    for (const cargo of c.cargos) {
      if (cargo.promotionStage !== null) expect(stageIds).toContain(cargo.promotionStage);
    }
    for (const node of c.skillNodes) {
      if (node.unlocksSkill !== undefined) expect(skillIds, node.id).toContain(node.unlocksSkill);
      for (const required of node.requires) expect(nodeIds, `${node.id} requires`).toContain(required);
    }
    for (const item of c.items) {
      if (item.unique.kind === 'skill') expect(skillIds, `${item.id} unique`).toContain(item.unique.skill);
      if (item.set !== undefined) expect(setIds, `${item.id} set`).toContain(item.set);
    }
    for (const enemy of c.enemies) {
      for (const trait of enemy.traits) {
        if (trait.kind === 'split') {
          expect(enemyIds, `${enemy.id} splits`).toContain(trait.into);
          expect(c.enemies.find((target) => target.id === trait.into)?.boss).toBe(false);
        }
      }
    }
  });

  it('only uses real stats and meta targets in every modifier and affix', () => {
    const targets: string[] = [];
    const take = (modifiers: Modifier[]) => modifiers.forEach((modifier) => targets.push(modifier.target));
    c.skillNodes.forEach((node) => take(node.modifiers));
    c.mentors.forEach((mentor) => take(mentor.modifiers));
    c.waveBuffs.forEach((buff) => take(buff.modifiers));
    c.sets.forEach((set) => set.bonuses.forEach((bonus) => take(bonus.modifiers)));
    for (const item of c.items) {
      take(modifiersOf(item.unique));
      for (const affix of [item.primary, ...item.pool]) {
        targets.push(affix.target);
        expect(affix.min, `${item.id} ${affix.target}`).toBeGreaterThan(0);
        expect(affix.max, `${item.id} ${affix.target}`).toBeGreaterThan(affix.min);
      }
    }
    for (const target of targets) expect(VALID_TARGETS).toContain(target);
  });
});

describe('hackathon content: items', () => {
  it('lets every item base drop in at least one stage', () => {
    const dropped = new Set(c.stages.flatMap((stage) => stage.drops));
    for (const id of itemIds) expect(dropped.has(id), `${id} never drops`).toBe(true);
  });

  it('gives each base a primary affix, a pool of 3 to 5 without repeats, and a unique effect', () => {
    for (const item of c.items) {
      expect(item.pool.length, item.id).toBeGreaterThanOrEqual(3);
      expect(item.pool.length, item.id).toBeLessThanOrEqual(5);
      const targets = item.pool.map((affix) => affix.target);
      expect(duplicates(targets), `${item.id} pool repeats a target`).toEqual([]);
      expect(targets, `${item.id} pool repeats the primary`).not.toContain(item.primary.target);
      expect(item.unique.description.length).toBeGreaterThan(10);
    }
    const kinds = new Set(c.items.map((item) => item.unique.kind));
    expect([...kinds].sort()).toEqual(['critSplash', 'modifiers', 'secondWind', 'skill']);
  });

  it('has one set of four pieces, one per slot, with a 2 and a 4 piece bonus', () => {
    const [set] = c.sets;
    const pieces = c.items.filter((item) => item.set === set?.id);
    expect(pieces).toHaveLength(4);
    expect(pieces.map((piece) => piece.slot).sort()).toEqual([...SLOT_IDS].sort());
    expect(set?.bonuses.map((bonus) => bonus.pieces)).toEqual([2, 4]);
  });

  it('spreads the set pieces over late stages', () => {
    const pieces = c.items.filter((item) => item.set !== undefined).map((item) => item.id);
    for (const piece of pieces) {
      const stagesWithPiece = c.stages.filter((stage) => stage.drops.includes(piece));
      expect(stagesWithPiece.length).toBeGreaterThan(0);
      for (const stage of stagesWithPiece) expect(stage.order, `${piece} in ${stage.id}`).toBeGreaterThanOrEqual(5);
    }
  });

  it('has rarity weights that sum to 100 and tiers that rise', () => {
    expect(c.rarities.map((rarity) => rarity.id)).toEqual([...RARITIES]);
    expect(c.rarities.reduce((sum, rarity) => sum + rarity.weight, 0)).toBeCloseTo(100, 10);
    expect(c.rarities.map((rarity) => rarity.extraAffixes)).toEqual([0, 1, 1, 2, 2]);
    for (let index = 1; index < c.rarities.length; index += 1) {
      const [before, after] = [c.rarities[index - 1]!, c.rarities[index]!];
      expect(after.valueMultiplier).toBeGreaterThan(before.valueMultiplier);
      expect(after.recycleCommits).toBeGreaterThan(before.recycleCommits);
      expect(after.weight).toBeLessThan(before.weight);
    }
  });
});

describe('hackathon content: progression', () => {
  it('has one mentor per professor with 5 rising costs', () => {
    expect(c.mentors.map((mentor) => mentor.professor)).toEqual([...PROFESSOR_IDS]);
    for (const mentor of c.mentors) {
      expect(mentor.costs, mentor.professor).toHaveLength(5);
      for (let index = 1; index < mentor.costs.length; index += 1) {
        expect(mentor.costs[index]!).toBeGreaterThan(mentor.costs[index - 1]!);
      }
      expect(mentor.modifiers.length).toBeGreaterThan(0);
      expect(mentor.teaches.length).toBeGreaterThan(10);
    }
  });

  it('has cargos in order with the design numbers', () => {
    expect(c.cargos.map((cargo) => [cargo.id, cargo.maxLevel, cargo.skillSlots, cargo.classroomMultiplier])).toEqual([
      ['estudante', 10, 1, 1],
      ['estagiario', 20, 2, 1.25],
    ]);
    expect(c.cargos[0]?.promotionStage).toBe('cap1-chefao');
    expect(c.cargos[1]?.promotionStage).toBeNull();
  });

  it('has an acyclic, reachable skill tree that cannot be bought whole with 19 points', () => {
    const byId = new Map<string, SkillNodeDef>(c.skillNodes.map((node) => [node.id, node]));
    const visiting = new Set<string>();
    const done = new Set<string>();
    const visit = (id: string): void => {
      if (done.has(id)) return;
      expect(visiting.has(id), `cycle through ${id}`).toBe(false);
      visiting.add(id);
      for (const required of byId.get(id)?.requires ?? []) visit(required);
      visiting.delete(id);
      done.add(id);
    };
    nodeIds.forEach(visit);
    // Reachable: every chain ends in a root, and a root exists in each branch.
    for (const branch of ['codigo', 'infra', 'produto'] as const) {
      const own = c.skillNodes.filter((node) => node.branch === branch);
      expect(own, branch).toHaveLength(4);
      expect(own.filter((node) => node.requires.length === 0), branch).toHaveLength(1);
    }
    expect(c.skillNodes.filter((node) => node.unlocksSkill !== undefined)).toHaveLength(4);
    expect(duplicates(c.skillNodes.flatMap((node) => (node.unlocksSkill ? [node.unlocksSkill] : [])))).toEqual([]);
    const positions = c.skillNodes.map((node) => `${node.position.col},${node.position.row}`);
    expect(duplicates(positions)).toEqual([]);
    for (const node of c.skillNodes) {
      expect(node.position.col).toBeGreaterThanOrEqual(0);
      expect(node.position.col).toBeLessThanOrEqual(2);
      for (const required of node.requires) {
        expect(byId.get(required)!.position.row, `${node.id} below ${required}`).toBeLessThan(node.position.row);
      }
    }
    const total = c.skillNodes.reduce((sum, node) => sum + node.cost * node.maxLevel, 0);
    const pointsAtLevel20 = 19;
    expect(total).toBeGreaterThan(pointsAtLevel20 * 2);
    const cheapestRoute = Math.min(...c.skillNodes.map((node) => node.cost));
    expect(cheapestRoute).toBeGreaterThanOrEqual(1);
  });

  it('has stages numbered 1 to 9 with the boss last and levels that never fall', () => {
    expect(c.stages.map((stage) => stage.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(c.stages.filter((stage) => stage.boss).map((stage) => stage.order)).toEqual([9]);
    expect(c.stages.every((stage) => stage.chapter === 1)).toBe(true);
    expect(c.stages[0]?.requires).toBeNull();
    c.stages.forEach((stage, index) => {
      if (index === 0) return;
      const previous = c.stages[index - 1]!;
      expect(stage.requires).toBe(previous.id);
      expect(stage.level).toBeGreaterThan(previous.level);
      expect(stage.requiredLevel).toBeGreaterThanOrEqual(previous.requiredLevel);
      // The boss pays little XP on purpose: it is the stage farmed after promotion, and cheap XP there is
      // what stretches the climb from level 10 to 20.
      if (!stage.boss) expect(stage.xp).toBeGreaterThan(previous.xp);
      expect(stage.commits).toBeGreaterThan(previous.commits);
    });
    expect(c.stages.at(-1)?.requiredLevel).toBe(10);
    expect(c.stages.at(-1)?.waves.at(-1)).toContain('deploy-de-sexta');
  });

  it('never asks for a level above the cargo cap the stage belongs to', () => {
    const studentCap = c.cargos.find((cargo) => cargo.id === 'estudante')!.maxLevel;
    for (const stage of c.stages) expect(stage.requiredLevel, stage.id).toBeLessThanOrEqual(studentCap);
  });

  it('has a boss with a charge, and enemies with the traits of the design', () => {
    const trait = (enemy: string, kind: string) =>
      c.enemies.find((candidate) => candidate.id === enemy)?.traits.some((entry) => entry.kind === kind);
    expect(trait('loop-infinito', 'stun')).toBe(true);
    expect(trait('vazamento-de-memoria', 'ramp')).toBe(true);
    expect(trait('codigo-legado', 'armor')).toBe(true);
    expect(trait('conflito-de-merge', 'split')).toBe(true);
    expect(trait('deploy-de-sexta', 'charge')).toBe(true);
    expect(c.enemies.find((enemy) => enemy.id === 'bug')?.traits).toEqual([]);
    for (const enemy of c.enemies) {
      expect(enemy.hp).toBeGreaterThan(0);
      expect(enemy.damage).toBeGreaterThan(0);
      expect(enemy.attackSpeed).toBeGreaterThan(0);
    }
  });

  it('gives wave buffs that are a clear choice', () => {
    for (const buff of c.waveBuffs) {
      expect(buff.modifiers.length > 0 || buff.heal !== undefined, `${buff.id} does nothing`).toBe(true);
    }
    expect(c.waveBuffs.filter((buff) => buff.heal !== undefined).length).toBeGreaterThanOrEqual(2);
    expect(c.waveBuffs.some((buff) => buff.modifiers.some((modifier) => modifier.value < 0))).toBe(true);
  });

  it('gives every daily rule at least one effect', () => {
    for (const rule of c.dailyModifiers) {
      const effects = [rule.enemyHpPercent, rule.enemyDamagePercent, rule.lootQuality, rule.xpPercent, rule.noHealing];
      expect(
        effects.some((effect) => effect !== undefined),
        rule.id,
      ).toBe(true);
    }
  });
});

describe('hackathon content: assets and tone', () => {
  it('follows the asset key conventions', () => {
    for (const cargo of c.cargos) expect(cargo.body).toBe(`hackathon/bodies/${cargo.id}`);
    for (const head of c.heads) expect(head.asset).toBe(`hackathon/heads/${head.id}`);
    for (const item of c.items) expect(item.asset).toBe(`hackathon/items/${item.id}`);
    for (const enemy of c.enemies) expect(enemy.asset).toBe(`hackathon/enemies/${enemy.id}`);
    for (const stage of c.stages) expect(stage.arena).toBe('hackathon/arenas/capitulo-1');
    for (const id of [...itemIds, ...enemyIds, ...ids(c.heads)]) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('names and describes everything, with no banned words', () => {
    const banned = /cerveja|chopp|bebida|bebad|cachaça|vodka|caipirinha|\bbar\b|porra|caralho|merda/i;
    const described = [
      ...c.cargos.map((entry) => ({ id: entry.id, text: entry.name })),
      ...c.heads.map((entry) => ({ id: entry.id, text: entry.name })),
      ...c.skillNodes.map((entry) => ({ id: entry.id, text: `${entry.name} ${entry.description}` })),
      ...c.skills.map((entry) => ({ id: entry.id, text: `${entry.name} ${entry.description}` })),
      ...c.items.map((entry) => ({ id: entry.id, text: `${entry.name} ${entry.description} ${entry.unique.description}` })),
      ...c.enemies.map((entry) => ({ id: entry.id, text: `${entry.name} ${entry.description}` })),
      ...c.waveBuffs.map((entry) => ({ id: entry.id, text: `${entry.name} ${entry.description}` })),
      ...c.stages.map((entry) => ({ id: entry.id, text: `${entry.name} ${entry.description}` })),
      ...c.dailyModifiers.map((entry) => ({ id: entry.id, text: `${entry.name} ${entry.description}` })),
      ...c.mentors.map((entry) => ({ id: entry.professor, text: entry.teaches })),
    ];
    for (const entry of described) {
      expect(entry.text.trim().length, entry.id).toBeGreaterThan(5);
      expect(entry.text, entry.id).not.toMatch(banned);
    }
    for (const entry of [...c.skillNodes, ...c.skills, ...c.items, ...c.enemies, ...c.waveBuffs]) {
      expect(entry.emoji.length, entry.id).toBeGreaterThan(0);
    }
  });
});
