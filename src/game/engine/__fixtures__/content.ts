/**
 * A small, valid GameContent for tests. Cheap numbers and one professor per feature, so every
 * engine rule can be exercised without depending on the real content.
 */
import { PROFESSOR_IDS } from '../../content/types';
import type {
  AbilityDef,
  AchievementDef,
  BalanceConfig,
  ClickUpgradeDef,
  DisciplineDef,
  Feature,
  GameContent,
  InvasionDef,
  PrestigeNodeDef,
  ProfessorDef,
  ProfessorId,
  Requirement,
  ResearchDef,
  SceneryDef,
  SkinDef,
  SprintDef,
  ThemeDef,
} from '../../content/types';

const palette = { primary: '#111111', secondary: '#222222', accent: '#333333' };

function professor(
  id: ProfessorId,
  order: number,
  hireCost: string,
  features: Feature[],
  requires: Requirement[] = [],
): ProfessorDef {
  return {
    id,
    name: id.toUpperCase(),
    subject: `Disciplina de ${id}`,
    tagline: `Camada de ${id}`,
    color: '#ffffff',
    order,
    hireCost,
    requires,
    features,
    quotes: { hire: 'Oi', click: ['Clique'], idle: ['Idle'], milestone: ['Marco'] },
  };
}

function discipline(
  id: string,
  professorId: ProfessorId,
  tier: number,
  baseCost: string,
  baseProduction: string,
): DisciplineDef {
  return { id, professor: professorId, tier, name: `Nome ${id}`, emoji: '📘', description: id, baseCost, baseProduction };
}

function research(
  id: string,
  professorId: ProfessorId,
  cost: string,
  effects: ResearchDef['effects'],
  requires: Requirement[] = [],
  unlocksAbility?: string,
): ResearchDef {
  return { id, professor: professorId, name: `Pesquisa ${id}`, emoji: '🔬', description: id, cost, effects, requires, unlocksAbility };
}

function skin(id: string, professorId: ProfessorId, isDefault = false): SkinDef {
  return {
    id,
    professor: professorId,
    name: id,
    rarity: isDefault ? 'common' : 'rare',
    description: id,
    default: isDefault || undefined,
    body: `skins/${id}`,
    palette,
    artPrompt: id,
  };
}

function scenery(id: string, isDefault = false): SceneryDef {
  return {
    id,
    name: id,
    description: id,
    default: isDefault || undefined,
    asset: `sceneries/${id}`,
    ambient: 'none',
    palette: { sky: '#000000', horizon: '#111111', floor: '#222222' },
    artPrompt: id,
  };
}

function theme(id: string, isDefault = false): ThemeDef {
  const colors = { bg: '#000', surface: '#111', surfaceRaised: '#222', border: '#333', text: '#fff', textMuted: '#999' };
  return { id, name: id, description: id, default: isDefault || undefined, colors };
}

function achievement(
  id: string,
  condition: AchievementDef['condition'],
  reward?: AchievementDef['reward'],
  secret = false,
): AchievementDef {
  return { id, family: secret ? 'secret' : 'click', name: id, emoji: '🏆', description: id, secret: secret || undefined, condition, reward };
}

export const fixtureBalance: BalanceConfig = {
  costGrowth: 1.15,
  minCostGrowth: 1.07,
  milestones: [10, 25, 50, 100, 200],
  milestoneStep: 100,
  milestoneMult: 2,
  tierUnlockLevel: 10,
  baseClick: 1,
  combo: { windowMs: 1500, baseMax: 20, baseStep: 0.05, decayPerSecond: 5 },
  crit: { baseChance: 0.03, baseMult: 7 },
  activeBonus: 1.5,
  achievementBonus: 0.01,
  offline: { baseHours: 2, baseRate: 0.5, minAwayMs: 60_000 },
  events: { minIntervalMs: 75_000, maxIntervalMs: 150_000 },
  sprints: { offers: 3, cooldownMs: 60_000 },
  rewardClickFloor: 10,
  graduation: { base: '1000', exponent: 0.5, bonusPerDiploma: 0.02 },
};

const professors: Record<ProfessorId, ProfessorDef> = {
  edecio: professor('edecio', 1, '0', ['combo']),
  gladimir: professor('gladimir', 2, '100', ['offline']),
  b2: professor('b2', 3, '1000', ['bulkBuy', 'hudThemes']),
  wagner: professor('wagner', 4, '5000', ['events']),
  guto: professor('guto', 5, '20000', ['abilities']),
  b1: professor('b1', 6, '80000', ['sprints']),
  angelo: professor('angelo', 7, '300000', ['synergy', 'graduation']),
  pablo: professor('pablo', 8, '1e7', ['complexity'], [{ kind: 'graduations', count: 1 }]),
};

const disciplines: DisciplineDef[] = [
  discipline('cafe', 'edecio', 0, '10', '1'),
  discipline('muito-legal', 'edecio', 1, '100', '5'),
  discipline('programacao', 'edecio', 2, '1000', '20'),
  discipline('sql', 'gladimir', 0, '50', '3'),
  discipline('iot', 'gladimir', 1, '500', '15'),
  discipline('wireframe', 'b2', 0, '400', '10'),
  discipline('firewall', 'wagner', 0, '2000', '30'),
  discipline('cloud', 'guto', 0, '8000', '100'),
  discipline('board', 'b1', 0, '30000', '300'),
  discipline('coord', 'angelo', 0, '100000', '1000'),
  discipline('bigo', 'pablo', 0, '1e6', '10000'),
];

const clickUpgrades: ClickUpgradeDef[] = [
  { id: 'joinha', professor: 'edecio', name: 'Joinha', emoji: '👍', description: 'Mais por clique', baseCost: '20', baseClick: '1', requires: [] },
  {
    id: 'turbo',
    professor: 'edecio',
    name: 'Turbo',
    emoji: '⚡',
    description: 'Exige o Café no nível 5',
    baseCost: '200',
    baseClick: '5',
    requires: [{ kind: 'disciplineLevel', discipline: 'cafe', level: 5 }],
  },
];

const researchList: ResearchDef[] = [
  research('r-clickpower', 'edecio', '50', [{ stat: 'clickPower', op: 'mult', value: 2 }]),
  research('r-crit', 'edecio', '100', [{ stat: 'critChance', op: 'add', value: 0.1 }], [{ kind: 'research', research: 'r-clickpower' }]),
  research('r-aula', 'edecio', '150', [], [], 'aula-show'),
  research('r-global', 'edecio', '60', [{ stat: 'globalPower', op: 'add', value: 1 }, { stat: 'globalPower', op: 'mult', value: 2 }]),
  research('r-disc-cafe', 'edecio', '70', [{ stat: 'disc:cafe', op: 'mult', value: 3 }]),
  research('r-prof-gladimir', 'gladimir', '80', [{ stat: 'prof:gladimir', op: 'mult', value: 4 }]),
  research('r-offline', 'gladimir', '300', [
    { stat: 'offlineHours', op: 'add', value: 10 },
    { stat: 'offlineRate', op: 'add', value: 0.5 },
  ]),
  research('r-auto', 'gladimir', '200', [{ stat: 'autoClicks', op: 'add', value: 2 }]),
  research('r-discount', 'b2', '900', [{ stat: 'costMult', op: 'mult', value: 0.5 }]),
  research('r-synergy', 'angelo', '400000', [{ stat: 'synergy', op: 'add', value: 0.05 }]),
  research('r-complexity', 'pablo', '2e7', [{ stat: 'costGrowth', op: 'add', value: -0.05 }]),
];

const abilities: AbilityDef[] = [
  {
    id: 'auto-scaling',
    professor: 'guto',
    name: 'Auto Scaling',
    emoji: '☁️',
    description: 'Produção x5',
    cooldownMs: 600_000,
    buff: { id: 'buff-scale', name: 'Auto Scaling', emoji: '☁️', durationMs: 30_000, effects: [{ stat: 'idlePower', op: 'mult', value: 5 }] },
  },
  {
    id: 'aula-show',
    professor: 'edecio',
    name: 'Aula Show',
    emoji: '🎤',
    description: 'Clique x10',
    cooldownMs: 120_000,
    unlockedByResearch: 'r-aula',
    buff: { id: 'buff-aula', name: 'Aula Show', emoji: '🎤', durationMs: 15_000, effects: [{ stat: 'clickPower', op: 'mult', value: 10 }] },
  },
];

const invasions: InvasionDef[] = [
  {
    id: 'phishing',
    name: 'Phishing',
    emoji: '🎣',
    description: 'Clique no anzol',
    weight: 3,
    windowMs: 10_000,
    clicksRequired: 3,
    reward: { kind: 'coins', seconds: 60 },
  },
  {
    id: 'ddos',
    name: 'DDoS',
    emoji: '🌊',
    description: 'Segure a onda',
    weight: 1,
    windowMs: 8000,
    clicksRequired: 5,
    reward: {
      kind: 'buff',
      buff: { id: 'buff-ddos', name: 'Calma', emoji: '🧘', durationMs: 30_000, effects: [{ stat: 'idlePower', op: 'mult', value: 7 }] },
    },
  },
];

function sprint(id: string, goal: SprintDef['goal'], requires: Requirement[] = []): SprintDef {
  return {
    id,
    name: id,
    emoji: '🏃',
    description: id,
    goal,
    durationMs: 60_000,
    reward: { kind: 'coins', seconds: 60 },
    requires,
  };
}

const sprints: SprintDef[] = [
  sprint('spr-clicks', { kind: 'clicks', amount: 10 }),
  sprint('spr-crits', { kind: 'crits', amount: 2 }),
  sprint('spr-combo', { kind: 'reachCombo', amount: 5 }),
  sprint('spr-buy', { kind: 'buyLevels', amount: 3 }),
  sprint('spr-defend', { kind: 'defendEvents', amount: 1 }, [{ kind: 'professorHired', professor: 'wagner' }]),
  sprint('spr-earn', { kind: 'earnSeconds', amount: 30 }),
];

function node(
  id: string,
  branch: PrestigeNodeDef['branch'],
  cost: number,
  costGrowth: number,
  maxLevel: number,
  effects: PrestigeNodeDef['effects'],
  requires: string[],
  col: number,
  row: number,
  keepsProfessors?: ProfessorId[],
): PrestigeNodeDef {
  return { id, branch, name: id, emoji: '🌳', description: id, cost, costGrowth, maxLevel, effects, requires, position: { col, row }, keepsProfessors };
}

const prestigeNodes: PrestigeNodeDef[] = [
  node('core-power', 'core', 1, 2, 3, [{ stat: 'globalPower', op: 'mult', value: 1.5 }], [], 0, 0),
  node('core-keep', 'core', 2, 1, 1, [], ['core-power'], 0, 1, ['gladimir']),
  node('click-power', 'click', 1, 1, 2, [{ stat: 'clickPower', op: 'add', value: 1 }], ['core-power'], 1, 1),
  node('idle-power', 'idle', 1, 1, 1, [{ stat: 'idlePower', op: 'mult', value: 2 }], ['core-power'], 2, 1),
  node('events-reward', 'events', 1, 1, 1, [{ stat: 'eventReward', op: 'mult', value: 2 }], ['core-power'], 3, 1),
  node('core-gain', 'core', 1, 1, 2, [{ stat: 'diplomaGain', op: 'add', value: 0.5 }], ['core-power'], 0, 2),
];

const skins: SkinDef[] = [
  ...PROFESSOR_IDS.map((id) => skin(`${id}-default`, id, true)),
  skin('edecio-cafe', 'edecio'),
  skin('edecio-chad', 'edecio'),
  skin('gladimir-dba', 'gladimir'),
];

const achievements: AchievementDef[] = [
  achievement('a-clicks', { kind: 'counter', counter: 'clicks', gte: 10 }, { skin: 'edecio-cafe' }),
  achievement('a-lifetime', { kind: 'lifetimeCoins', gte: '1000' }, { scenery: 'laboratorio' }),
  achievement('a-cps', { kind: 'coinsPerSecond', gte: '10' }),
  achievement('a-click-value', { kind: 'clickValue', gte: '5' }),
  achievement('a-disc-level', { kind: 'disciplineLevel', discipline: 'cafe', level: 5 }),
  achievement('a-all-disc', { kind: 'allDisciplinesLevel', professor: 'edecio', level: 5 }),
  achievement('a-hire-gladimir', { kind: 'professorHired', professor: 'gladimir' }, { theme: 'claro' }),
  achievement('a-hired-3', { kind: 'professorsHired', gte: 3 }),
  achievement('a-all-research', { kind: 'allResearch', professor: 'gladimir' }),
  achievement('a-diplomas', { kind: 'diplomasEarned', gte: 1 }),
  achievement('a-nodes', { kind: 'prestigeNodes', gte: 1 }),
  achievement('a-ach-3', { kind: 'achievements', gte: 3 }),
  achievement('a-skins', { kind: 'skinsOwned', gte: 2, professor: 'edecio' }, { skin: 'edecio-chad' }),
  achievement('a-secret', { kind: 'secret', trigger: 'konami' }, { skin: 'gladimir-dba' }, true),
];

/** Fresh copy each time, so a test can adjust the balance or lists without affecting others. */
export function createFixtureContent(): GameContent {
  return {
    professors: { ...professors },
    disciplines: [...disciplines],
    clickUpgrades: [...clickUpgrades],
    research: [...researchList],
    abilities: [...abilities],
    invasions: [...invasions],
    sprints: [...sprints],
    prestigeNodes: [...prestigeNodes],
    achievements: [...achievements],
    skins: [...skins],
    sceneries: [scenery('sala', true), scenery('laboratorio')],
    themes: [theme('escuro', true), theme('claro')],
    balance: { ...fixtureBalance, graduation: { ...fixtureBalance.graduation } },
  };
}

export const fixture: GameContent = createFixtureContent();
