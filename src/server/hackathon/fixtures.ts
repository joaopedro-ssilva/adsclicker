/**
 * A tiny content set and a scripted engine for the server's tests: the services take their
 * engine and content as arguments, so rules like "double finish pays once" are tested without
 * depending on how the real simulation balances a fight.
 */
import { hackathonContent } from '@/hackathon/content';
import { RARITIES } from '@/hackathon/content/types';
import type { AffixDef, HackathonContent, ItemBaseDef, ItemRarity, StageDef } from '@/hackathon/content/types';
import type { Build, HackathonEngine, ItemInstance, ResolvedStage, RunOutcome } from '@/hackathon/engine/types';
import type { HackathonDeps } from './deps';

const affix: AffixDef = { target: 'logica', op: 'add', min: 1, max: 5 };
const unique = { kind: 'secondWind', description: 'Uma segunda chance.' } as const;

const itemBase = (id: string, slot: ItemBaseDef['slot']): ItemBaseDef => ({
  id,
  slot,
  name: id,
  emoji: '🧪',
  description: id,
  primary: affix,
  pool: [affix],
  unique,
  asset: `hackathon/items/${id}`,
});

const stage = (id: string, order: number, requiredLevel: number, requires: string | null, boss = false): StageDef => ({
  id,
  chapter: 1,
  order,
  name: `Fase ${id}`,
  description: id,
  level: order,
  requiredLevel,
  requires,
  boss,
  waves: [['bug']],
  drops: ['tool-a', 'setup-a'],
  xp: 100,
  commits: 40,
  arena: 'hackathon/arenas/test',
});

export const PROMOTION_STAGE = 'boss';

export const fixtureContent: HackathonContent = {
  ...hackathonContent,
  cargos: [
    {
      id: 'estudante',
      name: 'Estudante',
      order: 1,
      maxLevel: 3,
      skillSlots: 1,
      classroomMultiplier: 1,
      promotionStage: PROMOTION_STAGE,
      body: 'b',
    },
    {
      id: 'estagiario',
      name: 'Estagiário',
      order: 2,
      maxLevel: 6,
      skillSlots: 2,
      classroomMultiplier: 1.25,
      promotionStage: null,
      body: 'b',
    },
  ],
  heads: [
    { id: 'h1', name: 'Um', asset: 'hackathon/heads/h1' },
    { id: 'h2', name: 'Dois', asset: 'hackathon/heads/h2' },
  ],
  skillNodes: [
    {
      id: 'n1',
      branch: 'codigo',
      name: 'N1',
      emoji: '1',
      description: '',
      cost: 1,
      maxLevel: 2,
      modifiers: [],
      requires: [],
      position: { col: 0, row: 0 },
    },
    {
      id: 'n2',
      branch: 'codigo',
      name: 'N2',
      emoji: '2',
      description: '',
      cost: 1,
      maxLevel: 1,
      modifiers: [],
      unlocksSkill: 'sk1',
      requires: ['n1'],
      position: { col: 0, row: 1 },
    },
  ],
  skills: [
    { id: 'sk1', name: 'S1', emoji: '1', description: '', cooldownMs: 1000, effect: { kind: 'strike', hitMultiplier: 2 } },
    { id: 'sk2', name: 'S2', emoji: '2', description: '', cooldownMs: 1000, effect: { kind: 'strike', hitMultiplier: 2 } },
  ],
  mentors: [
    { professor: 'edecio', teaches: '', modifiers: [], costs: [10, 20] },
    { professor: 'b2', teaches: '', modifiers: [], costs: [10] },
    { professor: 'gladimir', teaches: '', modifiers: [], costs: [10] },
  ],
  items: [itemBase('tool-a', 'ferramenta'), itemBase('tool-b', 'ferramenta'), itemBase('setup-a', 'setup')],
  stages: [stage('s1', 1, 1, null), stage('s2', 2, 2, 's1'), stage(PROMOTION_STAGE, 3, 3, 's2', true)],
  dailyModifiers: [],
  config: {
    ...hackathonContent.config,
    cafe: { max: 3, regenMinutes: 10, boughtPerDayCap: 4 },
    graduation: { xp: 50, perDayCap: 1 },
    inventorySize: 3,
    respecCommits: 100,
    minRunTimeShare: 0.5,
    runExpiryMinutes: 30,
    defeatXpShare: 0.3,
    firstClear: { minRarity: 'incomum', commitsMultiplier: 2 },
  },
};

export interface Script {
  outcome: Partial<RunOutcome>;
  /** Items the next victory drops. */
  drops: { base: string; rarity: ItemRarity }[];
}

export interface FakeHackathon {
  deps: HackathonDeps;
  script: Script;
  /** Replays the calls made to simulateRun. */
  simulated: { actions: number; seed: number; stageId: string }[];
}

const rarityRank = (rarity: ItemRarity): number => RARITIES.indexOf(rarity);

/** Deterministic stand-in for the engine: what it returns is whatever the test's script says. */
export function createFake(): FakeHackathon {
  const script: Script = { outcome: {}, drops: [{ base: 'tool-a', rarity: 'comum' }] };
  const simulated: FakeHackathon['simulated'] = [];
  const unsupported = (name: string) => (): never => {
    throw new Error(`fake engine: ${name} is not used by the server`);
  };

  const engine: HackathonEngine = {
    computeBuild: (input, content): Build => ({
      stats: { ...content.config.baseStats, logica: content.config.baseStats.logica + input.level },
      meta: { dropExtra: 0, lootQuality: 0, commitsGain: 0, xpGain: 0, setBonus: 0, bossDamage: 0, skillPower: 0, cooldown: 0 },
      skills: input.activeSkills,
      uniques: [],
      sets: {},
    }),
    resolveStage: (id, dateKey, content): ResolvedStage | null => {
      const def = id === 'daily' ? content.stages[0] : content.stages.find((candidate) => candidate.id === id);
      if (!def) return null;
      return {
        id,
        name: id === 'daily' ? `Hackathon do dia ${dateKey}` : def.name,
        level: def.level,
        boss: def.boss,
        waves: def.waves,
        drops: def.drops,
        xp: def.xp,
        commits: def.commits,
        arena: def.arena,
        modifiers: [],
      };
    },
    createRun: unsupported('createRun'),
    stepRun: unsupported('stepRun'),
    simulateRun: (setup, actions): RunOutcome => {
      simulated.push({ actions: actions.length, seed: setup.seed, stageId: setup.stage.id });
      return { won: true, reason: 'cleared', wavesCleared: 1, ticks: 100, hpLeft: 50, ...script.outcome };
    },
    rollDrops: (context) => {
      const items = script.drops.map((drop): ItemInstance => ({
        id: context.newId(),
        base: drop.base,
        rarity: drop.rarity,
        level: context.stage.level,
        affixes: [
          { target: 'logica', op: 'add', value: 5, quality: 50 },
          { target: 'foco', op: 'add', value: 3, quality: 50 },
        ],
        quality: 50,
        rerolls: 0,
        createdAt: context.now,
      }));
      const legendary = items.some((item) => item.rarity === 'lendario');
      return { items, pity: legendary ? 0 : context.pity + 1 };
    },
    rerollAffix: (item, index) => ({
      ...item,
      affixes: item.affixes.map((entry, at) => (at === index ? { ...entry, value: entry.value + 1 } : entry)),
      rerolls: item.rerolls + 1,
    }),
    rerollCost: (item) => 50 * 2 ** item.rerolls,
    recycleValue: (item) => 10 * (rarityRank(item.rarity) + 1),
    itemScore: (item) => rarityRank(item.rarity) * 1000 + item.quality,
    xpToNext: (level) => 100 * level,
    applyXp: (current, amount, content) => {
      const cap = content.cargos.find((cargo) => cargo.id === current.cargo)?.maxLevel ?? current.level;
      let { level, xp } = current;
      xp += amount;
      while (level < cap && xp >= 100 * level) {
        xp -= 100 * level;
        level += 1;
      }
      return { level, xp, levelsGained: level - current.level };
    },
    freeSkillPoints: (level, skillNodes, content) =>
      Math.max(0, level - 1 - content.skillNodes.reduce((sum, node) => sum + node.cost * (skillNodes[node.id] ?? 0), 0)),
    nodeLock: (node, _level, skillNodes, content) => {
      const def = content.skillNodes.find((candidate) => candidate.id === node);
      if (!def) return 'Habilidade desconhecida.';
      return def.requires.every((required) => (skillNodes[required] ?? 0) > 0) ? null : 'Falta um pré-requisito.';
    },
    mentorCost: (professor, level, content) => content.mentors.find((mentor) => mentor.professor === professor)?.costs[level] ?? null,
    classroomBonus: (input, content) => ({
      cargo: content.cargos.find((cargo) => cargo.id === input.cargo)?.classroomMultiplier ?? 1,
      mentors: Object.fromEntries(Object.entries(input.mentors).map(([id, level]) => [id, 1 + 0.1 * (level ?? 0)])),
    }),
  };

  let counter = 0;
  const deps: HackathonDeps = {
    engine,
    content: fixtureContent,
    rng: () => 0.5,
    newId: () => {
      counter += 1;
      return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
    },
  };
  return { deps, script, simulated };
}
