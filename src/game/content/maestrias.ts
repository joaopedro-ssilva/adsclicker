import { FESTA_BUFF_PREFIX } from './types';
import type { BolsaAssetDef, BuffDef, MaestriaDef, MaestriasConfig, ProfessorId } from './types';

/**
 * Maestrias: one special mechanic per professor. Every graduation gives one slot, the player picks
 * the professor who gets it (level 1), and four more levels are bought with diplomas.
 *
 * Costs are the same for all eight, 1,950 diplomas for levels 2 to 5: the eight maxed come
 * to 15,600 on top of the tree's 1,890, so diplomas keep a purpose well past the twentieth Formatura
 * (the speed-up of every purchase is what shortens the runs, so the sink has to last).
 */
const LEVEL_COSTS = [75, 225, 525, 1125];

const def = (professor: ProfessorId, name: string, summary: string, built: boolean): MaestriaDef => ({
  professor,
  name,
  summary,
  built,
  levelCosts: LEVEL_COSTS,
});

const defs: Record<ProfessorId, MaestriaDef> = {
  edecio: def(
    'edecio',
    'Joinha de Ouro',
    'A cada tantos cliques, o próximo clique é de ouro e vale segundos da produção da turma inteira.',
    true,
  ),
  gladimir: def(
    'gladimir',
    'Rollforward',
    'Cliques enchem uma carga. Cheia, ela avança o jogo no tempo: as ADScoins do período chegam de uma vez e as recargas andam junto.',
    true,
  ),
  b2: def(
    'b2',
    'Design System',
    'Comprar um nível dá níveis grátis nas aulas cujo próximo nível custa menos do que você acabou de pagar. Só desce, nunca sobe.',
    true,
  ),
  wagner: def(
    'wagner',
    'Super invasão',
    'Uma vez por hora, um enxame de bugs toma o palco, com um chefe no final. Quanto mais bugs derrotados, maior o prêmio.',
    true,
  ),
  guto: def(
    'guto',
    'Festa de lançamento',
    'Um botão de recarga longa: um minuto de caos com todas as habilidades disparando de uma vez, tudo mais forte e mais invasões.',
    true,
  ),
  b1: def(
    'b1',
    'Releases',
    'A cada punhado de sprints concluídos sai uma versão nova, que soma produção até o fim da turma. No máximo 10 versões.',
    true,
  ),
  angelo: def(
    'angelo',
    'Horas complementares',
    'Tudo o que você faz na turma conta horas. Cada faixa preenchida rende um diploma extra na formatura, fora do limite.',
    true,
  ),
  pablo: def(
    'pablo',
    'Bolsa de tokens',
    'Ativos de IA com preço que oscila: compre com ADScoins e venda depois. Mais um fundo lento e seguro.',
    true,
  ),
};

// ---------------------------------------------------------------------------
// Guto: the party is a buff per level (the save reads buffs by id, so the numbers live in the buff)
// ---------------------------------------------------------------------------

const FESTA_SECONDS = [40, 45, 50, 55, 60];
const FESTA_POWER = [1.1, 1.15, 1.2, 1.25, 1.3];
const FESTA_COOLDOWN = [0.6, 0.5, 0.45, 0.4, 0.35];
const FESTA_INVASIONS = [0.6, 0.5, 0.45, 0.4, 0.35];

const festaBuffs: BuffDef[] = FESTA_SECONDS.map((seconds, index) => ({
  id: `${FESTA_BUFF_PREFIX}${index + 1}`,
  name: 'Festa de lançamento',
  emoji: '🎉',
  durationMs: seconds * 1000,
  effects: [
    { stat: 'globalPower', op: 'mult', value: FESTA_POWER[index] ?? 1 },
    { stat: 'abilityCooldown', op: 'mult', value: FESTA_COOLDOWN[index] ?? 1 },
    { stat: 'eventInterval', op: 'mult', value: FESTA_INVASIONS[index] ?? 1 },
  ],
}));

// ---------------------------------------------------------------------------
// Pablo: the assets of the Bolsa de tokens
// ---------------------------------------------------------------------------

const assets: BolsaAssetDef[] = [
  {
    id: 'gpu',
    name: 'GPU',
    emoji: '🖥️',
    blurb: 'Calma: sobe e desce devagar, como o preço de quem já comprou a placa.',
    temperament: 'calm',
    unlockLevel: 1,
    lo: 0.8,
    hi: 1.25,
    start: 1,
    revert: 0.08,
    noise: 0.012,
  },
  {
    id: 'dados',
    name: 'Dados',
    emoji: '🗄️',
    blurb: 'Cíclico: enche e esvazia em ondas de uns 15 minutos. Dá para pegar o ritmo.',
    temperament: 'cyclic',
    unlockLevel: 2,
    lo: 0.6,
    hi: 1.6,
    start: 1,
    revert: 0.25,
    noise: 0.012,
    amplitude: 0.35,
    periodSteps: 90,
  },
  {
    id: 'modelo',
    name: 'Modelo',
    emoji: '🧠',
    blurb: 'Nervoso: de vez em quando dispara ou despenca, e depois volta ao normal.',
    temperament: 'spiky',
    unlockLevel: 3,
    lo: 0.45,
    hi: 2,
    start: 1,
    revert: 0.04,
    noise: 0.02,
    spikeChance: 0.03,
    spikeSize: 0.35,
  },
  {
    id: 'startup',
    name: 'Startup',
    emoji: '🦄',
    blurb: 'Selvagem: promete a lua, entrega um pitch. Pode triplicar ou virar poeira.',
    temperament: 'spiky',
    unlockLevel: 4,
    lo: 0.25,
    hi: 3,
    start: 1,
    revert: 0.03,
    noise: 0.03,
    spikeChance: 0.04,
    spikeSize: 0.6,
  },
];

/**
 * Rewards are seconds of production, so they grow with the save. Starting points from the design brief,
 * tuned with the simulator (see GAME_DESIGN, section on Maestrias).
 */
export const maestrias: MaestriasConfig = {
  defs,
  joinha: {
    // A golden click is big (seconds of the whole class) and rare: at 10 clicks per second, level 5 adds about a third
    // to production. With the old 100 to 60 clicks it more than tripled it, and the server could not tell it from cheating.
    clicksNeeded: [1000, 900, 800, 700, 600],
    seconds: [6, 9, 12, 16, 20],
    critFromLevel: 3,
    holdFromLevel: 5,
    holdPerSecond: 10,
  },
  rollforward: {
    // A long jump that takes a while to charge (5 minutes of fast clicking): about a quarter more production at
    // level 5. Charged every 300 clicks, the same jump was worth several times the production itself.
    clicksToFill: 3000,
    jumpSeconds: [15, 25, 35, 50, 70],
    maxCharges: [1, 1, 2, 2, 3],
  },
  swarm: {
    chargeMinutes: [60, 52, 45, 38, 30],
    durationMs: 45_000,
    bugs: 24,
    firstSpawnMs: 1_000,
    spawnEveryMs: 1_300,
    bugLifeMs: 6_500,
    bossAtMs: 33_000,
    kinds: [
      { id: 'bug', name: 'Bug', sprite: 'hackathon/enemies/bug', hp: 2, weight: 4 },
      { id: 'loop-infinito', name: 'Loop infinito', sprite: 'hackathon/enemies/loop-infinito', hp: 3, weight: 3 },
      { id: 'vazamento-de-memoria', name: 'Vazamento de memória', sprite: 'hackathon/enemies/vazamento-de-memoria', hp: 3, weight: 3 },
      { id: 'codigo-legado', name: 'Código legado', sprite: 'hackathon/enemies/codigo-legado', hp: 4, weight: 2 },
      { id: 'conflito-de-merge', name: 'Conflito de merge', sprite: 'hackathon/enemies/conflito-de-merge', hp: 4, weight: 2 },
      { id: 'bug-de-merge', name: 'Bug de merge', sprite: 'hackathon/enemies/bug-de-merge', hp: 5, weight: 1 },
    ],
    boss: { id: 'deploy-de-sexta', name: 'Deploy de sexta', sprite: 'hackathon/enemies/deploy-de-sexta', hp: 24 },
    bugSeconds: 4,
    bossSeconds: 30,
    clearBonus: 1.5,
    rewardMult: [1, 1.25, 1.5, 1.8, 2.2],
    firewallEveryMs: [0, 3_000, 2_000, 1_300, 800],
  },
  designSystem: {
    chance: [0.06, 0.09, 0.12, 0.15, 0.18],
    reach: [1, 1, 2, 2, 3],
    maxRolls: 10,
  },
  festa: {
    rechargeMinutes: [60, 55, 50, 45, 40],
    seconds: FESTA_SECONDS,
    power: FESTA_POWER,
    cooldown: FESTA_COOLDOWN,
    invasions: FESTA_INVASIONS,
    buffs: festaBuffs,
  },
  releases: {
    sprintsPerVersion: [5, 5, 4, 4, 3],
    bonus: [0.015, 0.02, 0.025, 0.03, 0.035],
    maxVersions: 10,
  },
  horas: {
    hoursPerBand: 10,
    bands: [2, 3, 4, 5, 6],
    sourceShare: 0.3,
    weights: { click: 0.005, invasion: 0.5, sprint: 0.75, ability: 0.5, level: 0.02 },
  },
  bolsa: {
    stepMs: 10_000,
    catchUpSteps: 360,
    historyLength: 60,
    limitMinutes: [2, 4, 6, 10, 15],
    fundPerMinute: [0.002, 0.0025, 0.003, 0.0035, 0.004],
    assets,
  },
};
