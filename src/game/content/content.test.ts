import Decimal from 'break_infinity.js';
import { describe, expect, it } from 'vitest';
import { content, PROFESSOR_IDS } from './index';
import type { Condition, Effect, Requirement, Reward } from './index';

const DECIMAL_PATTERN = /^\d+(\.\d+)?(e\d+)?$/;

const dec = (value: string): Decimal => {
  expect(value, `"${value}" is not a plain decimal string`).toMatch(DECIMAL_PATTERN);
  return new Decimal(value);
};

const ids = (items: { id: string }[]): string[] => items.map((item) => item.id);
const duplicates = (list: string[]): string[] => list.filter((item, index) => list.indexOf(item) !== index);

const EXPECTED_SKIN_IDS = [
  'edecio-default',
  'edecio-cafe',
  'edecio-programador',
  'edecio-chad',
  'edecio-cria',
  'edecio-prisioneiro',
  'edecio-atleta',
  'edecio-full-dima',
  'edecio-ceo',
  'edecio-gladiador',
  'edecio-samurai',
  'gladimir-default',
  'gladimir-dba',
  'gladimir-maker',
  'gladimir-piloto',
  'gladimir-mestre',
  'b2-default',
  'b2-postit',
  'b2-wireframe',
  'b2-darkmode',
  'b2-paleta',
  'wagner-default',
  'wagner-hacker',
  'wagner-agente',
  'wagner-firewall',
  'wagner-cripto',
  'guto-default',
  'guto-churrasqueiro',
  'guto-pagodeiro',
  'guto-dj',
  'guto-astronauta',
  'b1-default',
  'b1-po',
  'b1-flexbox',
  'b1-lancamento',
  'b1-rainha',
  'angelo-default',
  'angelo-terno',
  'angelo-maestro',
  'angelo-paraninfo',
  'angelo-rei',
  'pablo-default',
  'pablo-cientista',
  'pablo-enxadrista',
  'pablo-mago',
  'pablo-galactico',
];

const EXPECTED_SKIN_RARITY: Record<string, string> = {
  'edecio-default': 'common',
  'edecio-cafe': 'common',
  'edecio-programador': 'common',
  'edecio-chad': 'rare',
  'edecio-cria': 'rare',
  'edecio-prisioneiro': 'rare',
  'edecio-atleta': 'rare',
  'edecio-full-dima': 'epic',
  'edecio-ceo': 'epic',
  'edecio-gladiador': 'epic',
  'edecio-samurai': 'legendary',
  'gladimir-default': 'common',
  'gladimir-dba': 'common',
  'gladimir-maker': 'rare',
  'gladimir-piloto': 'epic',
  'gladimir-mestre': 'legendary',
  'b2-default': 'common',
  'b2-postit': 'common',
  'b2-wireframe': 'rare',
  'b2-darkmode': 'epic',
  'b2-paleta': 'legendary',
  'wagner-default': 'common',
  'wagner-hacker': 'common',
  'wagner-agente': 'rare',
  'wagner-firewall': 'epic',
  'wagner-cripto': 'legendary',
  'guto-default': 'common',
  'guto-churrasqueiro': 'common',
  'guto-pagodeiro': 'rare',
  'guto-dj': 'epic',
  'guto-astronauta': 'legendary',
  'b1-default': 'common',
  'b1-po': 'common',
  'b1-flexbox': 'rare',
  'b1-lancamento': 'epic',
  'b1-rainha': 'legendary',
  'angelo-default': 'common',
  'angelo-terno': 'common',
  'angelo-maestro': 'rare',
  'angelo-paraninfo': 'epic',
  'angelo-rei': 'legendary',
  'pablo-default': 'common',
  'pablo-cientista': 'common',
  'pablo-enxadrista': 'rare',
  'pablo-mago': 'epic',
  'pablo-galactico': 'legendary',
};

const SKINS_WITH_HEADGEAR = [
  'edecio-cria',
  'edecio-full-dima',
  'edecio-gladiador',
  'edecio-samurai',
  'gladimir-maker',
  'gladimir-piloto',
  'gladimir-mestre',
  'wagner-agente',
  'wagner-cripto',
  'guto-pagodeiro',
  'guto-astronauta',
  'b1-rainha',
  'angelo-paraninfo',
  'angelo-rei',
  'pablo-mago',
];

const EXPECTED_SCENERY_IDS = [
  'sala-de-aula',
  'laboratorio',
  'academia',
  'praia',
  'prisao',
  'nether',
  'casa-automatica',
  'arena',
  'cidade',
  'deserto',
  'templo',
  'datacenter',
  'coordenacao',
  'formatura',
];

const EXPECTED_AMBIENT: Record<string, string> = {
  'sala-de-aula': 'dust',
  laboratorio: 'code',
  academia: 'dust',
  praia: 'leaves',
  prisao: 'dust',
  nether: 'embers',
  'casa-automatica': 'none',
  arena: 'confetti',
  cidade: 'rain',
  deserto: 'dust',
  templo: 'leaves',
  datacenter: 'code',
  coordenacao: 'dust',
  formatura: 'confetti',
};

const ORIGINAL_UPGRADE_NAMES = [
  'Café Quentinho',
  'Muito Legal',
  'Programação',
  'Academia Avenida',
  'Projetinho',
  'Prainha',
  'Cria',
  'Prisão',
  'Nether',
  'Full Dima',
  'Casa Automática',
  'Atleta',
  'Cidade',
  'Ceo',
  'Exílio',
  'Gladiador',
  'Templo',
  'Samurai',
];

const disciplineIds = ids(content.disciplines);
const clickUpgradeIds = ids(content.clickUpgrades);
const researchIds = ids(content.research);
const abilityIds = ids(content.abilities);
const sprintIds = ids(content.sprints);
const prestigeIds = ids(content.prestigeNodes);
const skinIds = ids(content.skins);
const sceneryIds = ids(content.sceneries);
const themeIds = ids(content.themes);
const achievementIds = ids(content.achievements);
const levelledIds = new Set([...disciplineIds, ...clickUpgradeIds]);
const professorSet = new Set<string>(PROFESSOR_IDS);

function requirementProblems(requirement: Requirement): string[] {
  switch (requirement.kind) {
    case 'professorHired':
      return professorSet.has(requirement.professor) ? [] : [`unknown professor ${requirement.professor}`];
    case 'disciplineLevel':
      return levelledIds.has(requirement.discipline) ? [] : [`unknown discipline ${requirement.discipline}`];
    case 'research':
      return researchIds.includes(requirement.research) ? [] : [`unknown research ${requirement.research}`];
    case 'graduations':
      return requirement.count > 0 ? [] : ['graduations count must be positive'];
  }
}

function conditionProblems(condition: Condition): string[] {
  switch (condition.kind) {
    case 'disciplineLevel':
      return levelledIds.has(condition.discipline) ? [] : [`unknown discipline ${condition.discipline}`];
    case 'professorHired':
    case 'allDisciplinesLevel':
    case 'allResearch':
      return professorSet.has(condition.professor) ? [] : [`unknown professor ${condition.professor}`];
    case 'skinsOwned':
      return condition.professor === undefined || professorSet.has(condition.professor)
        ? []
        : [`unknown professor ${condition.professor}`];
    case 'lifetimeCoins':
    case 'coinsPerSecond':
    case 'clickValue':
      return DECIMAL_PATTERN.test(condition.gte) ? [] : [`bad decimal ${condition.gte}`];
    default:
      return [];
  }
}

function effectProblems(effect: Effect): string[] {
  const problems: string[] = [];
  if (!Number.isFinite(effect.value)) problems.push(`non-finite effect value on ${effect.stat}`);
  if (effect.stat.startsWith('disc:')) {
    const target = effect.stat.slice('disc:'.length);
    if (!disciplineIds.includes(target)) problems.push(`stat ${effect.stat} points to an unknown discipline`);
  }
  if (effect.stat.startsWith('prof:')) {
    const target = effect.stat.slice('prof:'.length);
    if (!professorSet.has(target)) problems.push(`stat ${effect.stat} points to an unknown professor`);
  }
  if (effect.op === 'mult' && effect.value <= 0) problems.push(`mult effect on ${effect.stat} must be positive`);
  return problems;
}

function rewardEffects(reward: Reward): Effect[] {
  return reward.kind === 'buff' ? reward.buff.effects : [];
}

describe('content: ids', () => {
  it('has unique ids in every kind', () => {
    expect(duplicates(disciplineIds)).toEqual([]);
    expect(duplicates(clickUpgradeIds)).toEqual([]);
    expect(duplicates(researchIds)).toEqual([]);
    expect(duplicates(abilityIds)).toEqual([]);
    expect(duplicates(ids(content.invasions))).toEqual([]);
    expect(duplicates(sprintIds)).toEqual([]);
    expect(duplicates(prestigeIds)).toEqual([]);
    expect(duplicates(achievementIds)).toEqual([]);
    expect(duplicates(skinIds)).toEqual([]);
    expect(duplicates(sceneryIds)).toEqual([]);
    expect(duplicates(themeIds)).toEqual([]);
  });

  it('shares no id between disciplines and click upgrades (they share the levels map)', () => {
    expect(duplicates([...disciplineIds, ...clickUpgradeIds])).toEqual([]);
  });

  it('keys the professors record by the professor id and in hire order', () => {
    expect(Object.keys(content.professors)).toEqual([...PROFESSOR_IDS]);
    PROFESSOR_IDS.forEach((id, index) => {
      const professor = content.professors[id];
      expect(professor.id).toBe(id);
      expect(professor.order).toBe(index + 1);
    });
  });

  it('never reuses a buff id for a different buff definition', () => {
    const buffs = [
      ...content.abilities.map((ability) => ability.buff),
      ...content.invasions.flatMap((invasion) => (invasion.reward.kind === 'buff' ? [invasion.reward.buff] : [])),
      ...content.sprints.flatMap((sprint) => (sprint.reward.kind === 'buff' ? [sprint.reward.buff] : [])),
    ];
    const definitions = new Map<string, string>();
    for (const buff of buffs) {
      const signature = JSON.stringify(buff);
      const known = definitions.get(buff.id);
      if (known !== undefined) expect(known, `buff ${buff.id} has two definitions`).toBe(signature);
      definitions.set(buff.id, signature);
    }
    expect(buffs.length).toBeGreaterThan(0);
  });
});

describe('content: references', () => {
  it('has requirements that point to things that exist', () => {
    const problems: string[] = [];
    const check = (owner: string, requirements: Requirement[]) => {
      for (const requirement of requirements) {
        for (const problem of requirementProblems(requirement)) problems.push(`${owner}: ${problem}`);
      }
    };
    for (const professor of Object.values(content.professors)) check(`professor ${professor.id}`, professor.requires);
    for (const upgrade of content.clickUpgrades) check(`click ${upgrade.id}`, upgrade.requires);
    for (const item of content.research) check(`research ${item.id}`, item.requires);
    for (const sprint of content.sprints) check(`sprint ${sprint.id}`, sprint.requires);
    expect(problems).toEqual([]);
  });

  it('has achievement conditions that point to things that exist', () => {
    const problems = content.achievements.flatMap((achievement) =>
      conditionProblems(achievement.condition).map((problem) => `${achievement.id}: ${problem}`),
    );
    expect(problems).toEqual([]);
  });

  it('has effects with valid stat keys and values everywhere', () => {
    const problems: string[] = [];
    const check = (owner: string, effects: Effect[]) => {
      for (const effect of effects) for (const problem of effectProblems(effect)) problems.push(`${owner}: ${problem}`);
    };
    for (const item of content.research) check(`research ${item.id}`, item.effects);
    for (const ability of content.abilities) check(`ability ${ability.id}`, ability.buff.effects);
    for (const invasion of content.invasions) check(`invasion ${invasion.id}`, rewardEffects(invasion.reward));
    for (const sprint of content.sprints) check(`sprint ${sprint.id}`, rewardEffects(sprint.reward));
    for (const node of content.prestigeNodes) check(`prestige ${node.id}`, node.effects);
    expect(problems).toEqual([]);
  });

  it('links abilities and the research that unlocks them in both directions', () => {
    for (const item of content.research) {
      if (item.unlocksAbility === undefined) continue;
      const ability = content.abilities.find((candidate) => candidate.id === item.unlocksAbility);
      expect(ability, `research ${item.id} unlocks a missing ability`).toBeDefined();
      expect(ability?.unlockedByResearch).toBe(item.id);
    }
    for (const ability of content.abilities) {
      if (ability.unlockedByResearch === undefined) continue;
      const item = content.research.find((candidate) => candidate.id === ability.unlockedByResearch);
      expect(item, `ability ${ability.id} points to a missing research`).toBeDefined();
      expect(item?.unlocksAbility).toBe(ability.id);
    }
    expect(content.abilities.some((ability) => ability.id === 'auto-scaling' && ability.professor === 'guto')).toBe(true);
    expect(content.abilities.filter((ability) => ability.unlockedByResearch === undefined)).toHaveLength(1);
    expect(content.abilities.length).toBeGreaterThanOrEqual(3);
    expect(content.abilities.length).toBeLessThanOrEqual(4);
  });

  it('has a prestige tree whose references exist and that can be read as a tree', () => {
    const positions = new Set<string>();
    for (const node of content.prestigeNodes) {
      for (const required of node.requires) {
        const parent = content.prestigeNodes.find((candidate) => candidate.id === required);
        expect(parent, `${node.id} requires missing node ${required}`).toBeDefined();
        if (parent) expect(parent.position.row, `${node.id} must sit below ${required}`).toBeLessThan(node.position.row);
      }
      for (const kept of node.keepsProfessors ?? []) expect(professorSet.has(kept)).toBe(true);
      const key = `${node.position.col},${node.position.row}`;
      expect(positions.has(key), `two prestige nodes at ${key}`).toBe(false);
      positions.add(key);
      expect(Number.isInteger(node.cost) && node.cost > 0).toBe(true);
      expect(Number.isInteger(node.costGrowth) && node.costGrowth >= 1).toBe(true);
      expect(node.maxLevel).toBeGreaterThanOrEqual(1);
    }
    const roots = content.prestigeNodes.filter((node) => node.requires.length === 0);
    expect(roots).toHaveLength(1);
    expect(roots[0]?.position.row).toBe(0);
    expect(content.prestigeNodes.some((node) => (node.keepsProfessors ?? []).length > 0)).toBe(true);
    for (const branch of ['core', 'click', 'idle', 'events'] as const) {
      expect(content.prestigeNodes.some((node) => node.branch === branch), `branch ${branch} is empty`).toBe(true);
    }
  });

  it('keeps professors without gaps in hire order (a kept professor needs the previous one kept)', () => {
    const kept = content.prestigeNodes.flatMap((node) => node.keepsProfessors ?? []);
    const orders = kept.map((id) => content.professors[id].order).sort((a, b) => a - b);
    expect(orders).toEqual(orders.map((_, index) => index + 2));
    expect(kept).not.toContain('edecio');
  });
});

describe('content: professors, disciplines and numbers', () => {
  it('gives every professor exactly 3 disciplines with tiers 0, 1 and 2', () => {
    expect(content.disciplines).toHaveLength(24);
    for (const id of PROFESSOR_IDS) {
      const tiers = content.disciplines
        .filter((discipline) => discipline.professor === id)
        .map((discipline) => discipline.tier)
        .sort();
      expect(tiers, `professor ${id}`).toEqual([0, 1, 2]);
    }
  });

  it('lists disciplines in global order (hire order x tier)', () => {
    const expected = PROFESSOR_IDS.flatMap((id) => [0, 1, 2].map((tier) => `${id}:${tier}`));
    expect(content.disciplines.map((discipline) => `${discipline.professor}:${discipline.tier}`)).toEqual(expected);
  });

  it('has positive decimal costs and productions that grow along the hire order', () => {
    let previousCost = new Decimal(0);
    let previousProduction = new Decimal(0);
    for (const discipline of content.disciplines) {
      const cost = dec(discipline.baseCost);
      const production = dec(discipline.baseProduction);
      expect(cost.gt(0), `${discipline.id} cost`).toBe(true);
      expect(production.gt(0), `${discipline.id} production`).toBe(true);
      expect(cost.gt(previousCost), `${discipline.id} cost must grow`).toBe(true);
      expect(production.gt(previousProduction), `${discipline.id} production must grow`).toBe(true);
      previousCost = cost;
      previousProduction = production;
    }
    expect(dec(content.disciplines[0]!.baseCost).toNumber()).toBe(60);
    expect(dec(content.disciplines[0]!.baseProduction).toNumber()).toBeCloseTo(0.2);
  });

  it('prices hires between the previous last tier and the new first tier', () => {
    PROFESSOR_IDS.forEach((id, index) => {
      const professor = content.professors[id];
      if (index === 0) {
        expect(dec(professor.hireCost).eq(0)).toBe(true);
        expect(professor.requires).toEqual([]);
        return;
      }
      const hire = dec(professor.hireCost);
      const previousLast = content.disciplines.filter((d) => d.professor === PROFESSOR_IDS[index - 1]).at(-1)!;
      const first = content.disciplines.find((d) => d.professor === id && d.tier === 0)!;
      expect(hire.gt(dec(previousLast.baseCost)), `${id} hire is above the previous last tier`).toBe(true);
      expect(hire.lt(dec(first.baseCost)), `${id} hire is below its own first tier`).toBe(true);
      expect(professor.requires).toContainEqual({ kind: 'professorHired', professor: PROFESSOR_IDS[index - 1] });
    });
    expect(content.professors.pablo.requires).toContainEqual({ kind: 'graduations', count: 1 });
  });

  it('gives each professor a distinct colour and the features from the design', () => {
    const colours = PROFESSOR_IDS.map((id) => content.professors[id].color);
    expect(new Set(colours).size).toBe(8);
    for (const colour of colours) expect(colour).toMatch(/^#[0-9a-f]{6}$/);
    expect(content.professors.edecio.features).toEqual(['combo']);
    expect(content.professors.gladimir.features).toEqual(['offline']);
    expect(content.professors.b2.features).toEqual(['bulkBuy', 'hudThemes']);
    expect(content.professors.wagner.features).toEqual(['events']);
    expect(content.professors.guto.features).toEqual(['abilities']);
    expect(content.professors.b1.features).toEqual(['sprints']);
    expect(content.professors.angelo.features).toEqual(['synergy', 'graduation']);
    expect(content.professors.pablo.features).toEqual(['complexity']);
  });

  it('gives every professor quotes in every slot', () => {
    for (const id of PROFESSOR_IDS) {
      const { quotes } = content.professors[id];
      expect(quotes.hire.length).toBeGreaterThan(0);
      expect(quotes.click.length).toBeGreaterThanOrEqual(3);
      expect(quotes.idle.length).toBeGreaterThanOrEqual(2);
      expect(quotes.milestone.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('has positive click upgrades spread over the cast, the first being Edécio\'s "Muito Legal"', () => {
    expect(content.clickUpgrades).toHaveLength(6);
    expect(content.clickUpgrades[0]?.id).toBe('muito-legal');
    expect(content.clickUpgrades[0]?.professor).toBe('edecio');
    expect(content.clickUpgrades[0]?.name).toBe('Muito Legal');
    expect(new Set(content.clickUpgrades.map((upgrade) => upgrade.professor)).size).toBeGreaterThanOrEqual(5);
    let previousCost = new Decimal(0);
    for (const upgrade of content.clickUpgrades) {
      const cost = dec(upgrade.baseCost);
      expect(cost.gt(previousCost), `${upgrade.id} cost must grow`).toBe(true);
      expect(dec(upgrade.baseClick).gt(0)).toBe(true);
      previousCost = cost;
    }
  });

  it('has 4 to 6 research per professor with positive costs', () => {
    expect(content.research.length).toBeGreaterThanOrEqual(36);
    expect(content.research.length).toBeLessThanOrEqual(44);
    for (const id of PROFESSOR_IDS) {
      const own = content.research.filter((item) => item.professor === id);
      expect(own.length, `research of ${id}`).toBeGreaterThanOrEqual(4);
      expect(own.length, `research of ${id}`).toBeLessThanOrEqual(6);
    }
    for (const item of content.research) {
      expect(dec(item.cost).gt(0), `${item.id} cost`).toBe(true);
      expect(item.effects.length > 0 || item.unlocksAbility !== undefined, `${item.id} does nothing`).toBe(true);
    }
  });

  it('lets Pablo reduce the cost growth down to 1.10 and no further', () => {
    const reduction = content.research
      .filter((item) => item.professor === 'pablo')
      .flatMap((item) => item.effects)
      .filter((effect) => effect.stat === 'costGrowth')
      .reduce((total, effect) => total + effect.value, 0);
    expect(content.balance.costGrowth + reduction).toBeCloseTo(1.1, 10);
    expect(content.balance.costGrowth + reduction).toBeGreaterThanOrEqual(content.balance.minCostGrowth);
  });

  it('only gates a research on disciplines of its own professor (plus hired professors)', () => {
    for (const item of content.research) {
      for (const requirement of item.requires) {
        if (requirement.kind !== 'disciplineLevel') continue;
        const discipline = content.disciplines.find((candidate) => candidate.id === requirement.discipline);
        expect(discipline?.professor, `${item.id} gate`).toBe(item.professor);
      }
    }
  });

  it('has invasions with sane parameters', () => {
    expect(content.invasions).toHaveLength(6);
    for (const invasion of content.invasions) {
      expect(invasion.weight).toBeGreaterThan(0);
      expect(invasion.windowMs).toBeGreaterThanOrEqual(5_000);
      expect(invasion.clicksRequired).toBeGreaterThanOrEqual(1);
      if (invasion.reward.kind === 'coins') {
        expect(invasion.reward.seconds).toBeGreaterThanOrEqual(10);
        expect(invasion.reward.seconds).toBeLessThanOrEqual(600);
      } else {
        expect(invasion.reward.buff.durationMs).toBeGreaterThan(0);
      }
    }
  });

  it('has about 12 sprints within 60 to 240 seconds, gated when they depend on another layer', () => {
    expect(content.sprints.length).toBeGreaterThanOrEqual(10);
    expect(content.sprints.length).toBeLessThanOrEqual(14);
    for (const sprint of content.sprints) {
      expect(sprint.durationMs).toBeGreaterThanOrEqual(60_000);
      expect(sprint.durationMs).toBeLessThanOrEqual(240_000);
      expect(sprint.goal.amount).toBeGreaterThan(0);
      if (sprint.goal.kind === 'defendEvents') {
        expect(sprint.requires).toContainEqual({ kind: 'professorHired', professor: 'wagner' });
      }
      if (sprint.goal.kind === 'crits' || sprint.goal.kind === 'reachCombo') {
        expect(sprint.requires.length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps the balance constants named in the design', () => {
    const { balance } = content;
    expect(balance.costGrowth).toBe(1.15);
    expect(balance.minCostGrowth).toBe(1.07);
    expect(balance.milestones).toEqual([10, 25, 50, 100, 200]);
    expect(balance.milestoneStep).toBe(100);
    expect(balance.milestoneMult).toBe(2);
    expect(balance.tierUnlockLevel).toBe(10);
    expect(balance.baseClick).toBe(1);
    expect(balance.combo).toEqual({ windowMs: 1500, baseMax: 20, baseStep: 0.05, decayPerSecond: 4 });
    expect(balance.crit).toEqual({ baseChance: 0.03, baseMult: 7 });
    expect(balance.activeBonus).toBe(1);
    expect(balance.achievementBonus).toBe(0.01);
    expect(balance.offline).toEqual({ baseHours: 2, baseRate: 0.5, minAwayMs: 60_000 });
    expect(balance.events).toEqual({ minIntervalMs: 75_000, maxIntervalMs: 150_000 });
    expect(balance.sprints).toEqual({ offers: 3, cooldownMs: 150_000 });
    expect(balance.rewardClickFloor).toBe(50);
    expect(balance.graduation).toEqual({ base: '2e19', exponent: 0.5, bonusPerDiploma: 0.01, maxBonus: 1 });
  });
});

describe('content: skins, sceneries and themes', () => {
  it('has exactly the 46 skins of the design, with their rarities', () => {
    expect(skinIds).toEqual(EXPECTED_SKIN_IDS);
    for (const skin of content.skins) {
      expect(skin.rarity, `${skin.id} rarity`).toBe(EXPECTED_SKIN_RARITY[skin.id]);
      expect(skin.id.startsWith(`${skin.professor}-`), `${skin.id} prefix`).toBe(true);
    }
  });

  it('has one default skin per professor, and nothing else is default', () => {
    for (const id of PROFESSOR_IDS) {
      const defaults = content.skins.filter((skin) => skin.professor === id && skin.default === true);
      expect(defaults.map((skin) => skin.id)).toEqual([`${id}-default`]);
    }
    expect(content.skins.filter((skin) => skin.default === true)).toHaveLength(8);
  });

  it('builds body and head asset keys from the skin id, with its own head only where the design lists headgear', () => {
    for (const skin of content.skins) {
      expect(skin.body).toBe(`skins/${skin.id}`);
      if (SKINS_WITH_HEADGEAR.includes(skin.id)) expect(skin.head).toBe(`heads/${skin.id}`);
      else expect(skin.head).toBeUndefined();
      for (const colour of Object.values(skin.palette)) expect(colour).toMatch(/^#[0-9a-f]{6}$/i);
      expect(skin.artPrompt.length).toBeGreaterThan(10);
      expect(skin.artPrompt).toMatch(/^[\x20-\x7e]+$/);
    }
  });

  it('has exactly the 14 sceneries of the design with one default', () => {
    expect(sceneryIds).toEqual(EXPECTED_SCENERY_IDS);
    expect(content.sceneries.filter((scenery) => scenery.default === true).map((scenery) => scenery.id)).toEqual([
      'sala-de-aula',
    ]);
    for (const scenery of content.sceneries) {
      expect(scenery.asset).toBe(`sceneries/${scenery.id}`);
      expect(scenery.ambient, `${scenery.id} ambient`).toBe(EXPECTED_AMBIENT[scenery.id]);
      for (const colour of Object.values(scenery.palette)) expect(colour).toMatch(/^#[0-9a-f]{6}$/i);
      expect(scenery.artPrompt).toContain('16:9');
      expect(scenery.artPrompt).toContain('lower third');
      expect(scenery.artPrompt).toMatch(/^[\x20-\x7e]+$/);
    }
  });

  it('has the 5 HUD themes with one default and legible contrast', () => {
    expect(themeIds).toEqual(['escuro', 'claro', 'alto-contraste', 'terminal', 'pastel']);
    expect(content.themes.filter((theme) => theme.default === true).map((theme) => theme.id)).toEqual(['escuro']);
    const luminance = (hex: string): number => {
      const channels = [1, 3, 5].map((start) => {
        const value = parseInt(hex.slice(start, start + 2), 16) / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
    };
    const contrast = (a: string, b: string): number => {
      const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (light! + 0.05) / (dark! + 0.05);
    };
    for (const theme of content.themes) {
      const { bg, surface, surfaceRaised, text, textMuted } = theme.colors;
      for (const colour of Object.values(theme.colors)) expect(colour).toMatch(/^#[0-9a-f]{6}$/i);
      const minimum = theme.id === 'alto-contraste' ? 7 : 4.5;
      for (const background of [bg, surface, surfaceRaised]) {
        expect(contrast(text, background), `${theme.id} text on ${background}`).toBeGreaterThanOrEqual(minimum);
        expect(contrast(textMuted, background), `${theme.id} muted on ${background}`).toBeGreaterThanOrEqual(
          theme.id === 'alto-contraste' ? 7 : 4.5,
        );
      }
    }
  });
});

describe('content: achievements', () => {
  it('has about 90 achievements spread over the families of the design', () => {
    expect(content.achievements.length).toBeGreaterThanOrEqual(88);
    expect(content.achievements.length).toBeLessThanOrEqual(98);
    const count = (family: string) => content.achievements.filter((a) => a.family === family).length;
    expect(count('click')).toBeGreaterThanOrEqual(10);
    expect(count('production')).toBeGreaterThanOrEqual(12);
    expect(count('professor')).toBeGreaterThanOrEqual(24);
    expect(count('events')).toBeGreaterThanOrEqual(6);
    expect(count('sprints')).toBeGreaterThanOrEqual(5);
    expect(count('graduation')).toBeGreaterThanOrEqual(6);
    expect(count('collection')).toBeGreaterThanOrEqual(5);
    expect(count('secret')).toBe(8);
  });

  it('covers every secret trigger of the design and hides only the secret family', () => {
    const triggers = content.achievements.flatMap((a) => (a.condition.kind === 'secret' ? [a.condition.trigger] : []));
    for (const trigger of ['logo-clicks', 'konami', 'night-owl', 'swap-spree', 'idle-watcher', 'joinha']) {
      expect(triggers).toContain(trigger);
    }
    for (const achievement of content.achievements) {
      expect(achievement.secret === true, achievement.id).toBe(achievement.family === 'secret');
    }
  });

  it('rewards every non-default skin, scenery and theme exactly once, and nothing unknown', () => {
    const rewarded = {
      skin: content.achievements.flatMap((a) => (a.reward?.skin ? [a.reward.skin] : [])),
      scenery: content.achievements.flatMap((a) => (a.reward?.scenery ? [a.reward.scenery] : [])),
      theme: content.achievements.flatMap((a) => (a.reward?.theme ? [a.reward.theme] : [])),
    };
    const nonDefault = <T extends { id: string; default?: boolean }>(items: T[]) =>
      items.filter((item) => item.default !== true).map((item) => item.id);
    expect([...rewarded.skin].sort()).toEqual(nonDefault(content.skins).sort());
    expect([...rewarded.scenery].sort()).toEqual(nonDefault(content.sceneries).sort());
    expect([...rewarded.theme].sort()).toEqual(nonDefault(content.themes).sort());
    expect(duplicates(rewarded.skin)).toEqual([]);
    expect(duplicates(rewarded.scenery)).toEqual([]);
    expect(duplicates(rewarded.theme)).toEqual([]);
  });

  it('gives rarer skins to harder achievements within each source family', () => {
    const byRarity = (rarity: string) =>
      content.achievements.filter((a) => a.reward?.skin && EXPECTED_SKIN_RARITY[a.reward.skin] === rarity);
    // Legendary skins come only from the level 100 ladder; epic ones from research or big counters.
    for (const achievement of byRarity('legendary')) expect(achievement.id).toMatch(/^lvl100-/);
    for (const achievement of byRarity('rare')) expect(achievement.id).not.toMatch(/^hire-/);
    for (const achievement of byRarity('common')) expect(achievement.id).not.toMatch(/^lvl100-|^research-/);
  });
});

describe('content: heritage and tone', () => {
  it('reuses the 18 original upgrade names somewhere in the content', () => {
    const names = [
      ...content.disciplines,
      ...content.clickUpgrades,
      ...content.research,
      ...content.sprints,
      ...content.invasions,
      ...content.prestigeNodes,
      ...content.achievements,
      ...content.skins,
      ...content.sceneries,
    ].map((item) => item.name);
    for (const original of ORIGINAL_UPGRADE_NAMES) {
      const pattern = new RegExp(`(^|[^\\p{L}])${original}([^\\p{L}]|$)`, 'iu');
      expect(
        names.some((name) => pattern.test(name)),
        `original name "${original}" is not used`,
      ).toBe(true);
    }
  });

  it('gives every item a name, an emoji and a description, and avoids banned words', () => {
    const described = [
      ...content.disciplines,
      ...content.clickUpgrades,
      ...content.research,
      ...content.abilities,
      ...content.invasions,
      ...content.sprints,
      ...content.prestigeNodes,
      ...content.achievements,
    ];
    const banned = /cerveja|chopp|bebida|bebad|cachaça|vodka|caipirinha|\bbar\b|porra|caralho|merda/i;
    for (const item of described) {
      expect(item.name.trim().length, `${item.id} name`).toBeGreaterThan(0);
      expect(item.emoji.length, `${item.id} emoji`).toBeGreaterThan(0);
      expect(item.description.trim().length, `${item.id} description`).toBeGreaterThan(10);
      expect(`${item.name} ${item.description}`).not.toMatch(banned);
    }
    for (const professor of Object.values(content.professors)) {
      const lines = [professor.tagline, professor.quotes.hire, ...professor.quotes.click, ...professor.quotes.idle];
      for (const line of [...lines, ...professor.quotes.milestone]) expect(line).not.toMatch(banned);
    }
  });
});
