import type { MaestriaDef, MaestriasConfig, ProfessorId } from './types';

/**
 * Maestrias: one special mechanic per professor. Every graduation gives one slot, the player picks
 * the professor who gets it (level 1), and four more levels are bought with diplomas.
 *
 * Costs are the same for the three built ones, 1,300 diplomas for levels 2 to 5: the eight maxed come
 * to 10,400 on top of the tree's 1,890, so diplomas keep a purpose once the tree is done.
 */
const LEVEL_COSTS = [50, 150, 350, 750];

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
    'Comprar um nível dá níveis grátis nas aulas cujo próximo nível custa menos do que você acabou de pagar.',
    false,
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
    'Um botão de recarga longa: um minuto de caos com todas as habilidades disparando de uma vez.',
    false,
  ),
  b1: def(
    'b1',
    'Releases',
    'A cada 5 sprints concluídos sai uma versão nova, que soma produção até o fim da turma.',
    false,
  ),
  angelo: def(
    'angelo',
    'Horas complementares',
    'Tudo o que você faz na turma conta horas. Cada faixa preenchida rende um diploma extra, fora do limite.',
    false,
  ),
  pablo: def(
    'pablo',
    'Bolsa de tokens',
    'Ativos com preço que oscila: compre com ADScoins e venda depois. Mais um fundo lento e seguro.',
    false,
  ),
};

/**
 * Rewards are seconds of production, so they grow with the save. Starting points from the design brief,
 * tuned with the simulator (see GAME_DESIGN, section on Maestrias).
 */
export const maestrias: MaestriasConfig = {
  defs,
  joinha: {
    clicksNeeded: [100, 90, 80, 70, 60],
    seconds: [6, 9, 12, 16, 20],
    critFromLevel: 3,
    holdFromLevel: 5,
    holdPerSecond: 10,
  },
  rollforward: {
    clicksToFill: 300,
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
    bugSeconds: 12,
    bossSeconds: 120,
    clearBonus: 1.5,
    rewardMult: [1, 1.25, 1.5, 1.8, 2.2],
    firewallEveryMs: [0, 3_000, 2_000, 1_300, 800],
  },
};
