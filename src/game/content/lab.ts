/**
 * The Laboratório de Pesquisa: every number of the mode in one place. Item bases, rarities, enemies, run buffs and
 * the Kit Plantão set are the Hackathon's (src/hackathon/content), reused as they are; what is new here is how they
 * feed the lab and the clicker. See docs/LABORATORIO.md.
 */
import { enemies as hackathonEnemies } from '../../hackathon/content/enemies';
import { items as hackathonItems, sets } from '../../hackathon/content/items';
import { rarities } from '../../hackathon/content/rarities';
import { waveBuffs } from '../../hackathon/content/waveBuffs';
import type {
  LabBonus,
  LabBuffDef,
  LabConfig,
  LabConversion,
  LabEffects,
  LabItemBase,
  LabNodeDef,
} from './labTypes';
import type { StatKey } from './types';

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

/** Power ~5, no affix: the only thing a run starts with. Cannot drop. */
const mouseQuebrado: LabItemBase = {
  id: 'mouse-quebrado',
  slot: 'ferramenta',
  name: 'Mouse quebrado',
  emoji: '🖱️',
  description: 'Clica quando quer. O botão direito virou decoração e a rodinha só gira para o lado errado.',
  primary: { target: 'logica', op: 'add', min: 0, max: 0 },
  pool: [],
  unique: { kind: 'modifiers', description: '', modifiers: [] },
  asset: 'hackathon/items/mouse-quebrado',
  drops: false,
  affixes: false,
};

const bases: LabItemBase[] = [
  mouseQuebrado,
  ...hackathonItems.map((base): LabItemBase => ({ ...base, drops: true, affixes: true })),
];

// ---------------------------------------------------------------------------
// What an affix is worth
// ---------------------------------------------------------------------------

const part = (stat: StatKey, per: number) => ({ stat, per });
const conv = (clicker: { stat: StatKey; per: number }[] = [], lab: LabEffects = {}): LabConversion => ({ clicker, lab });
/** The same conversion for a raw point and for a percent (targets that only ever roll one of the two). */
const both = (conversion: LabConversion) => ({ add: conversion, pct: conversion });

/**
 * Raw value of an affix = (rolled value at level 1) x (1 + valuePerLevel x (level - 1)). A legendary item of level 10
 * rolls about 10 to 21 points on its primary affix, which the table below turns into roughly +20 to +40% on the stat.
 */
const affixes: LabConfig['affixes'] = {
  // logica: damage per hit -> the value of a click
  logica: { add: conv([part('clickPower', 0.02)]), pct: conv([part('clickPower', 0.01)]) },
  // agilidade: attack speed -> a longer combo that falls slower
  agilidade: {
    add: conv([part('comboMax', 0.15), part('comboDecay', -0.006)]),
    pct: conv([part('comboMax', 0.05), part('comboDecay', -0.003)]),
  },
  // foco: health -> how long abilities last
  foco: { add: conv([part('abilityDuration', 0.003)]), pct: conv([part('abilityDuration', 0.01)]) },
  // resiliencia: damage taken -> how long an invasion stays on screen
  resiliencia: { add: conv([part('eventWindow', 0.015)]), pct: conv([part('eventWindow', 0.01)]) },
  // atencao: crit chance
  atencao: { add: conv([part('critChance', 0.01)]), pct: conv([part('critChance', 0.005)]) },
  cooldown: both(conv([part('abilityCooldown', -0.008)])),
  bossDamage: both(conv([part('eventReward', 0.01)])),
  commitsGain: both(conv([part('sprintReward', 0.01)])),
  skillPower: both(conv([part('activeBonus', 0.005)])),
  // lab only
  sorte: both(conv([], { luck: 1 })),
  lootQuality: both(conv([], { luck: 1 })),
  dropExtra: both(conv([], { extraOption: 1 })),
  xpGain: both(conv([], { commits: 0.01 })),
};

const skillBonuses: Record<string, LabBonus> = {
  deploy: { lab: { damage: 0.15 } },
  refatorar: { lab: { repairPhase: 0.03 } },
  firewall: { lab: { drain: -0.15 } },
  'cafe-duplo': { clicker: [{ stat: 'abilityCooldown', value: -0.15 }], lab: { damage: 0.1 } },
};

// ---------------------------------------------------------------------------
// Run buffs (the Hackathon's wave buffs, adapted)
// ---------------------------------------------------------------------------

const waveBuffById = new Map(waveBuffs.map((buff) => [buff.id, buff]));

/** A wave buff of the Hackathon: same modifiers (they feed the clicker through `affixes`), new text and lab effects. */
function adapt(id: string, description: string, lab: LabEffects): LabBuffDef {
  const source = waveBuffById.get(id);
  if (!source) throw new Error(`Hackathon wave buff "${id}" not found`);
  return { id, name: source.name, emoji: source.emoji, description, modifiers: source.modifiers, lab };
}

const buffs: LabBuffDef[] = [
  adapt('cafe-forte', '+20% de dano automático. O monitor aguenta; a cafeína também.', { damage: 0.2 }),
  adapt('stack-overflow', '+30% de dano automático. Copiou? Copiou. Funcionou? Funcionou.', { damage: 0.3 }),
  adapt('foco-total', '+10% de dano automático e +15% de dano em chefões.', { damage: 0.1, bossDamage: 0.15 }),
  adapt('code-review', 'Os mobs drenam 15% menos integridade. Alguém achou o bug antes de você.', { drain: -0.15 }),
  adapt('firewall-extra', 'Os mobs drenam 25% menos integridade, para quem prefere defender.', { drain: -0.25 }),
  adapt('pausa-para-agua', '+10% de integridade máxima. Hidratar também é manutenção.', { integrityPct: 0.1 }),
  adapt('pair-programming', '+15% de dano automático e 8% menos integridade drenada. Duas cabeças, um teclado.', {
    damage: 0.15,
    drain: -0.08,
  }),
  adapt('automacao', '+20% de dano automático. O monitor trabalha enquanto você descansa.', { damage: 0.2 }),
  adapt('deploy-na-sexta', 'Aposta: +60% de dano automático, mas -25% de integridade máxima. O que poderia dar errado?', {
    damage: 0.6,
    integrityPct: -0.25,
  }),
  adapt('tudo-ou-nada', 'Aposta: +35% de dano automático, mas -20% de integridade máxima.', {
    damage: 0.35,
    integrityPct: -0.2,
  }),
  {
    id: 'prazo-estendido',
    name: 'Prazo estendido',
    emoji: '📅',
    description: '+4 segundos no tempo dos chefões. Ninguém vai olhar o calendário.',
    modifiers: [{ target: 'foco', op: 'pct', value: 8 }],
    lab: { bossTime: 4 },
  },
  {
    id: 'ci-verde',
    name: 'CI verde',
    emoji: '✅',
    description: 'Repara 2% da integridade após cada fase e reduz em 5% a drenagem. Pipeline passando, vida em paz.',
    modifiers: [{ target: 'resiliencia', op: 'add', value: 6 }],
    lab: { repairPhase: 0.02, drain: -0.05 },
  },
];

// ---------------------------------------------------------------------------
// The permanent tree (Commits)
// ---------------------------------------------------------------------------

const tree: LabNodeDef[] = [
  // Código: damage
  {
    id: 'algoritmos-eficientes',
    branch: 'codigo',
    name: 'Algoritmos eficientes',
    emoji: '🧠',
    description: '+10% de dano automático por nível.',
    cost: 8,
    costGrowth: 1.4,
    maxLevel: 10,
    effects: { damage: 0.1 },
    requires: [],
    position: { col: 0, row: 0 },
  },
  {
    id: 'estudo-de-chefao',
    branch: 'codigo',
    name: 'Estudo de chefão',
    emoji: '📖',
    description: '+10% de dano em chefões por nível.',
    cost: 12,
    costGrowth: 1.5,
    maxLevel: 5,
    effects: { bossDamage: 0.1 },
    requires: ['algoritmos-eficientes'],
    position: { col: 0, row: 1 },
  },
  {
    id: 'setup-de-casa',
    branch: 'codigo',
    name: 'Setup de casa',
    emoji: '🪑',
    description: 'Toda corrida começa com um item comum no Setup, além do mouse quebrado.',
    cost: 25,
    costGrowth: 1,
    maxLevel: 1,
    effects: { startSetup: 1 },
    requires: ['algoritmos-eficientes'],
    position: { col: 0, row: 2 },
  },
  // Infra: the monitor
  {
    id: 'monitor-reforcado',
    branch: 'infra',
    name: 'Monitor reforçado',
    emoji: '🖥️',
    description: '+10 de integridade máxima por nível.',
    cost: 6,
    costGrowth: 1.35,
    maxLevel: 10,
    effects: { integrityFlat: 10 },
    requires: [],
    position: { col: 1, row: 0 },
  },
  {
    id: 'backup-noturno',
    branch: 'infra',
    name: 'Backup noturno',
    emoji: '💾',
    description: 'Repara 5% da integridade depois de cada chefão, por nível.',
    cost: 14,
    costGrowth: 1.5,
    maxLevel: 5,
    effects: { repairBoss: 0.05 },
    requires: ['monitor-reforcado'],
    position: { col: 1, row: 1 },
  },
  {
    id: 'prazo-folgado',
    branch: 'infra',
    name: 'Prazo folgado',
    emoji: '⏱️',
    description: '+5 segundos no tempo dos chefões por nível.',
    cost: 20,
    costGrowth: 1.7,
    maxLevel: 4,
    effects: { bossTime: 5 },
    requires: ['monitor-reforcado'],
    position: { col: 1, row: 2 },
  },
  {
    id: 'rede-segura',
    branch: 'infra',
    name: 'Rede segura',
    emoji: '🔒',
    description: 'Os mobs drenam 4% menos integridade por nível.',
    cost: 12,
    costGrowth: 1.45,
    maxLevel: 5,
    effects: { drain: -0.04 },
    requires: ['backup-noturno'],
    position: { col: 1, row: 3 },
  },
  {
    id: 'nobreak-do-lab',
    branch: 'infra',
    name: 'Nobreak do laboratório',
    emoji: '🔋',
    description: 'Uma vez por fase, uma queda fatal deixa o monitor com 15% de integridade.',
    cost: 60,
    costGrowth: 1,
    maxLevel: 1,
    effects: { secondWind: 1 },
    requires: ['prazo-folgado'],
    position: { col: 1, row: 4 },
  },
  // Produto: loot, Commits and the clicker
  {
    id: 'revisao-de-pr',
    branch: 'produto',
    name: 'Revisão de PR',
    emoji: '🔍',
    description: 'A primeira recompensa da corrida mostra 4 opções.',
    cost: 20,
    costGrowth: 1,
    maxLevel: 1,
    effects: { firstOptions: 1 },
    requires: [],
    position: { col: 2, row: 0 },
  },
  {
    id: 'codigo-limpo',
    branch: 'produto',
    name: 'Código limpo',
    emoji: '✨',
    description: '+5 de sorte por nível: mais chance de itens raros e lendários.',
    cost: 10,
    costGrowth: 1.4,
    maxLevel: 6,
    effects: { luck: 5 },
    requires: ['revisao-de-pr'],
    position: { col: 2, row: 1 },
  },
  {
    id: 'documentacao',
    branch: 'produto',
    name: 'Documentação',
    emoji: '📚',
    description: 'Os buffs do Laboratório valem 10% mais no clicker, por nível.',
    cost: 15,
    costGrowth: 1.5,
    maxLevel: 5,
    effects: { clicker: 0.1 },
    requires: ['revisao-de-pr'],
    position: { col: 2, row: 2 },
  },
  {
    id: 'portfolio-do-lab',
    branch: 'produto',
    name: 'Portfólio',
    emoji: '📁',
    description: '+20% de Commits por nível.',
    cost: 30,
    costGrowth: 1.8,
    maxLevel: 3,
    effects: { commits: 0.2 },
    requires: ['codigo-limpo'],
    position: { col: 2, row: 3 },
  },
];

// ---------------------------------------------------------------------------
// The whole config
// ---------------------------------------------------------------------------

export const lab: LabConfig = {
  unlock: { professor: 'pablo', diplomas: 100 },

  bases,
  starter: mouseQuebrado.id,
  sets,
  rarities,
  enemies: hackathonEnemies,
  buffs,
  tree,

  affixes,
  skillBonuses,
  secondWindBonus: { lab: { secondWind: 1 } },
  critSplash: conv([part('critChance', 0.0015)], { damage: 0.002 }),
  caps: {
    clickPower: 3,
    comboMax: 60,
    comboDecay: 0.7,
    abilityDuration: 2,
    eventWindow: 2,
    critChance: 0.45,
    abilityCooldown: 0.6,
    eventReward: 3,
    sprintReward: 3,
    activeBonus: 1.5,
  },
  labels: {
    stats: {
      clickPower: 'ADScoins por clique',
      comboMax: 'Combo máximo',
      comboDecay: 'Queda do combo',
      abilityDuration: 'Duração das habilidades',
      eventWindow: 'Tempo dos eventos na tela',
      critChance: 'Chance de crítico',
      abilityCooldown: 'Recarga das habilidades',
      eventReward: 'Recompensa dos eventos',
      sprintReward: 'Recompensa das sprints',
      activeBonus: 'Bônus do professor em sala',
    },
    effects: {
      damage: 'Dano automático',
      bossDamage: 'Dano em chefões',
      integrityPct: 'Integridade máxima',
      integrityFlat: 'Integridade máxima',
      drain: 'Integridade drenada',
      repairPhase: 'Reparo por fase',
      repairBoss: 'Reparo por chefão',
      bossTime: 'Tempo do chefão',
      luck: 'Sorte',
      extraOption: 'Chance de opção extra',
      commits: 'Commits',
      clicker: 'Buffs no clicker',
      firstOptions: 'Opções na primeira recompensa',
      secondWind: 'Segundo fôlego',
      startSetup: 'Setup inicial',
    },
  },

  items: {
    maxLevel: 20,
    valuePerLevel: 0.12,
    power: {
      base: 5,
      rarity: { comum: 1, incomum: 1.7, raro: 3, epico: 5.4, lendario: 10 },
      perLevel: 1.15,
    },
    dropLevelEvery: 3,
    bossLevelBonus: 1,
  },

  // Fixed numbers, one tier above Pablo (1.5e21). Level up: 1e24 for comum level 1, x10 per rarity step, x6 per level.
  // Reroll: 2e23 for the same item, x10 per rarity step, x3 per level and x2 per reroll already made on it.
  costs: {
    levelBase: '1e24',
    rarityStep: 10,
    levelGrowth: 6,
    rerollBase: '2e23',
    rerollRarityStep: 10,
    rerollLevelGrowth: 3,
    rerollGrowth: 2,
  },

  run: {
    stepSeconds: 0.1,
    maxAdvanceSeconds: 2,
    startIntegrity: 100,
    hpScale: 0.1,
    hpGrowth: 1.18,
    drainScale: 0.05,
    drainGrowth: 1.12,
    waveMin: 2,
    waveMax: 6,
    waveGrowEvery: 3,
    enemyFrom: { bug: 1, 'loop-infinito': 2, 'conflito-de-merge': 3, 'vazamento-de-memoria': 4, 'codigo-legado': 6 },
    bossEvery: 5,
    bossEnemy: 'deploy-de-sexta',
    bossHpFactor: 0.4,
    bossTimerSeconds: 30,
    armorPerPoint: 0.08,
    armorMax: 0.5,
    click: { share: 0.04, perWindow: 5, windowMs: 1000 },
    secondWindShare: 0.15,
    minDrainMult: 0.15,
    minIntegrity: 10,
  },

  rewards: {
    options: 3,
    maxOptions: 5,
    weights: { item: 3, buff: 3, commits: 1.5, repair: 1.5 },
    repairWhenHurt: 2.5,
    emptySlotWeight: 2,
    phaseQuality: 1.5,
    maxQuality: 400,
    commitsBase: 8,
    commitsPerPhase: 0.12,
    repairShare: 0.25,
    bossRepairShare: 0.4,
    bossRarityFloor: 'raro',
    bossSecondFloor: 'incomum',
    bossItems: 2,
  },

  commits: { perPhase: 3, perBoss: 25, recycleLevelBonus: 0.1 },
};
