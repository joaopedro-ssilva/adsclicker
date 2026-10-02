/** A small, valid HackathonContent for the engine tests: they never depend on the real content. */
import type {
  AffixDef,
  EnemyDef,
  HackathonContent,
  ItemBaseDef,
  SlotId,
  StageDef,
  UniqueEffect,
  WaveBuffDef,
} from '../../content/types';
import { computeBuild } from '../build';
import type { Build, ResolvedStage, RunSetup } from '../types';

const enemy = (id: string, over: Partial<EnemyDef> = {}): EnemyDef => ({
  id,
  name: id,
  emoji: 'x',
  description: id,
  boss: false,
  hp: 50,
  damage: 5,
  attackSpeed: 100,
  traits: [],
  asset: `hackathon/enemies/${id}`,
  ...over,
});

export const enemies: EnemyDef[] = [
  enemy('grunt'),
  enemy('mini', { hp: 10 }),
  enemy('stunner', { traits: [{ kind: 'stun', everyAttacks: 2 }] }),
  enemy('rampant', { traits: [{ kind: 'ramp', percentPerSecond: 50 }] }),
  enemy('tank', { traits: [{ kind: 'armor', flat: 3 }] }),
  enemy('splitter', { traits: [{ kind: 'split', into: 'mini', count: 2 }] }),
  enemy('timed', { hp: 100000, traits: [{ kind: 'timer', seconds: 5 }] }),
  enemy('charger', { traits: [{ kind: 'charge', everySeconds: 3, windupMs: 1500, hitMultiplier: 4 }] }),
  enemy('boss', { boss: true, hp: 400, damage: 8 }),
];

const affix = (target: AffixDef['target'], min: number, max: number, op: AffixDef['op'] = 'add'): AffixDef => ({ target, op, min, max });

const POOL: AffixDef[] = [
  affix('logica', 2, 6),
  affix('foco', 10, 30),
  affix('resiliencia', 2, 8),
  affix('atencao', 2, 6),
  affix('sorte', 2, 6),
];

const uniques: Record<string, UniqueEffect> = {
  a: { kind: 'secondWind', description: 'second wind' },
  b: { kind: 'critSplash', description: 'splash', chance: 100 },
  c: { kind: 'skill', description: 'strike', skill: 'strike' },
  d: { kind: 'modifiers', description: 'power', modifiers: [{ target: 'logica', op: 'pct', value: 50 }] },
};

function base(id: string, slot: SlotId, primary: AffixDef, unique: UniqueEffect, set?: string): ItemBaseDef {
  return {
    id,
    slot,
    name: id,
    emoji: 'i',
    description: id,
    primary,
    pool: POOL.filter((p) => p.target !== primary.target),
    unique,
    ...(set ? { set } : {}),
    asset: `hackathon/items/${id}`,
  };
}

export const items: ItemBaseDef[] = [
  base('ferr-a', 'ferramenta', affix('logica', 3, 6), uniques.a as UniqueEffect, 'kit'),
  base('ferr-b', 'ferramenta', affix('logica', 2, 4), uniques.b as UniqueEffect),
  base('setup-a', 'setup', affix('foco', 20, 40), uniques.c as UniqueEffect, 'kit'),
  base('setup-b', 'setup', affix('foco', 10, 30), uniques.d as UniqueEffect),
  base('acc-a', 'acessorio', affix('atencao', 3, 6), uniques.a as UniqueEffect, 'kit'),
  base('acc-b', 'acessorio', affix('sorte', 3, 6), uniques.b as UniqueEffect),
  base('amu-a', 'amuleto', affix('resiliencia', 3, 6), uniques.d as UniqueEffect, 'kit'),
  base('amu-b', 'amuleto', affix('dropExtra', 2, 4), uniques.d as UniqueEffect),
];

export const waveBuffs: WaveBuffDef[] = Array.from({ length: 12 }, (_, i): WaveBuffDef => ({
  id: `buff-${i}`,
  name: `Buff ${i}`,
  emoji: 'b',
  description: 'buff',
  modifiers: [{ target: i % 2 === 0 ? 'logica' : 'foco', op: 'add', value: i % 2 === 0 ? 2 : 10 }],
  ...(i === 3 ? { heal: { percentOfMaxHp: 50 } } : {}),
}));

const stage = (id: string, order: number, level: number, waves: string[][], over: Partial<StageDef> = {}): StageDef => ({
  id,
  chapter: 1,
  order,
  name: id,
  description: id,
  level,
  requiredLevel: 1,
  requires: order > 1 ? `s${order - 1}` : null,
  boss: false,
  waves,
  drops: ['ferr-a', 'setup-a', 'acc-a', 'amu-a'],
  xp: 50 * order,
  commits: 20 * order,
  arena: 'hackathon/arenas/test',
  ...over,
});

export const stages: StageDef[] = [
  stage('s1', 1, 1, [['grunt'], ['grunt'], ['grunt', 'grunt']]),
  stage('s2', 2, 2, [['grunt'], ['grunt', 'grunt'], ['stunner']]),
  stage('s3', 3, 3, [['grunt'], ['tank'], ['grunt', 'grunt'], ['charger']]),
  stage('boss', 4, 4, [['grunt'], ['splitter'], ['boss']], { boss: true, drops: ['ferr-a', 'ferr-b', 'setup-a'] }),
];

export const fixtureContent: HackathonContent = {
  cargos: [
    { id: 'estudante', name: 'Estudante', order: 1, maxLevel: 10, skillSlots: 2, classroomMultiplier: 1, promotionStage: 'boss', body: 'hackathon/bodies/estudante' },
    { id: 'estagiario', name: 'Estagiário', order: 2, maxLevel: 20, skillSlots: 3, classroomMultiplier: 1.25, promotionStage: null, body: 'hackathon/bodies/estagiario' },
  ],
  heads: [{ id: 'h1', name: 'H1', asset: 'hackathon/heads/h1' }],
  skillNodes: [
    { id: 'logic', branch: 'codigo', name: 'Lógica', emoji: 'l', description: '', cost: 1, maxLevel: 5, modifiers: [{ target: 'logica', op: 'add', value: 2 }], requires: [], position: { col: 0, row: 0 } },
    { id: 'u-heal', branch: 'infra', name: 'Cura', emoji: 'h', description: '', cost: 2, maxLevel: 1, modifiers: [], unlocksSkill: 'heal', requires: ['logic'], position: { col: 1, row: 0 } },
    { id: 'u-aoe', branch: 'codigo', name: 'Área', emoji: 'a', description: '', cost: 2, maxLevel: 1, modifiers: [], unlocksSkill: 'aoe', requires: ['logic'], position: { col: 0, row: 1 } },
    { id: 'u-block', branch: 'infra', name: 'Bloqueio', emoji: 'b', description: '', cost: 2, maxLevel: 1, modifiers: [], unlocksSkill: 'block', requires: ['logic'], position: { col: 1, row: 1 } },
    { id: 'u-haste', branch: 'produto', name: 'Pressa', emoji: 'p', description: '', cost: 2, maxLevel: 1, modifiers: [], unlocksSkill: 'haste', requires: ['logic'], position: { col: 2, row: 0 } },
    { id: 'u-strike', branch: 'produto', name: 'Golpe', emoji: 's', description: '', cost: 2, maxLevel: 1, modifiers: [], unlocksSkill: 'strike', requires: ['logic'], position: { col: 2, row: 1 } },
  ],
  skills: [
    { id: 'heal', name: 'Heal', emoji: 'h', description: '', cooldownMs: 10000, effect: { kind: 'heal', percentOfMaxHp: 30 } },
    { id: 'aoe', name: 'Aoe', emoji: 'a', description: '', cooldownMs: 8000, effect: { kind: 'aoe', hitMultiplier: 2 } },
    { id: 'block', name: 'Block', emoji: 'b', description: '', cooldownMs: 8000, effect: { kind: 'block', durationMs: 3000 } },
    { id: 'haste', name: 'Haste', emoji: 'p', description: '', cooldownMs: 10000, effect: { kind: 'haste', attackSpeedMultiplier: 2, durationMs: 5000 } },
    { id: 'strike', name: 'Strike', emoji: 's', description: '', cooldownMs: 6000, effect: { kind: 'strike', hitMultiplier: 4 } },
  ],
  mentors: [
    { professor: 'edecio', teaches: '', modifiers: [{ target: 'logica', op: 'add', value: 1 }], costs: [10, 20, 30] },
    { professor: 'gladimir', teaches: '', modifiers: [{ target: 'dropExtra', op: 'add', value: 5 }], costs: [10, 20] },
  ],
  items,
  sets: [
    {
      id: 'kit',
      name: 'Kit',
      bonuses: [
        { pieces: 2, description: '', modifiers: [{ target: 'logica', op: 'add', value: 10 }] },
        { pieces: 4, description: '', modifiers: [{ target: 'foco', op: 'add', value: 100 }] },
      ],
    },
  ],
  rarities: [
    { id: 'comum', name: 'Comum', weight: 60, extraAffixes: 0, valueMultiplier: 1, recycleCommits: 5 },
    { id: 'incomum', name: 'Incomum', weight: 26, extraAffixes: 1, valueMultiplier: 1.2, recycleCommits: 12 },
    { id: 'raro', name: 'Raro', weight: 10, extraAffixes: 2, valueMultiplier: 1.5, recycleCommits: 30 },
    { id: 'epico', name: 'Épico', weight: 3.3, extraAffixes: 3, valueMultiplier: 2, recycleCommits: 80 },
    { id: 'lendario', name: 'Lendário', weight: 0.7, extraAffixes: 3, valueMultiplier: 2.5, recycleCommits: 200 },
  ],
  enemies,
  waveBuffs,
  stages,
  dailyModifiers: [
    { id: 'tough', name: 'Tough', description: '', enemyHpPercent: 50 },
    { id: 'hard', name: 'Hard', description: '', enemyDamagePercent: 30 },
    { id: 'lucky', name: 'Lucky', description: '', lootQuality: 50 },
    { id: 'dry', name: 'Dry', description: '', noHealing: true },
  ],
  config: {
    baseStats: { logica: 10, agilidade: 100, foco: 120, resiliencia: 0, atencao: 5, sorte: 0 },
    statsPerLevel: { logica: 2, foco: 15 },
    xpBase: 100,
    xpStep: 60,
    defeatXpShare: 0.3,
    enemyScaling: { hpPercentPerLevel: 18, damagePercentPerLevel: 12 },
    itemValuePercentPerLevel: 8,
    flow: { minIntervalMs: 4000 },
    autoSkillPower: 0.8,
    critMultiplier: 2,
    cafe: { max: 5, regenMinutes: 15, boughtPerDayCap: 12 },
    graduation: { xp: 150, perDayCap: 3 },
    inventorySize: 40,
    pityVictories: 40,
    baseDropExtra: 10,
    bossDrops: 2,
    firstClear: { minRarity: 'incomum', commitsMultiplier: 2 },
    reroll: { baseCommits: 50 },
    respecCommits: 200,
    mentorClassroomBonus: 0.1,
    minRunTimeShare: 0.5,
    daily: { waves: 5, modifiers: 2 },
    runExpiryMinutes: 30,
  },
};

// ---------------------------------------------------------------------------
// Helpers shared by the tests
// ---------------------------------------------------------------------------

/** A level 1 student with no items, with some stats overridden. */
export function studentBuild(over: Partial<Build['stats']> = {}, skills: string[] = []): Build {
  const build = computeBuild({ cargo: 'estudante', level: 1, skillNodes: {}, mentors: {}, equipped: {}, activeSkills: [] }, fixtureContent);
  return { ...build, stats: { ...build.stats, ...over }, skills };
}

export function stageOf(waves: string[][], over: Partial<ResolvedStage> = {}): ResolvedStage {
  return {
    id: 'test',
    name: 'test',
    level: 1,
    boss: false,
    waves,
    drops: ['ferr-a'],
    xp: 10,
    commits: 10,
    arena: 'a',
    modifiers: [],
    ...over,
  };
}

export function setupOf(waves: string[][], build: Build = studentBuild(), over: Partial<RunSetup> = {}, stageOver: Partial<ResolvedStage> = {}): RunSetup {
  return { seed: 12345, build, stage: stageOf(waves, stageOver), auto: false, ...over };
}
