import type { MonitorDef } from './types';

/**
 * The four Monitores, hired with diplomas after the first Formatura. Four levels each: the first
 * hires, the rest make the monitor faster or better. Costs (diplomas) are tuned against the
 * diploma cap per run (10 x 2^graduations): the cheapest hire fits the second or third Formatura,
 * and the four maxed cost about 2,800 diplomas, more than the whole tree.
 */
export const monitors: MonitorDef[] = [
  {
    id: 'compras',
    name: 'Monitor de Compras',
    emoji: '🛒',
    description: 'Compra sozinho o nível de aula que mais rende por ADScoin, só nos professores que você já começou. Não conta como compra feita à mão.',
    levels: [
      { cost: 5, delayMs: 20_000, line: 'Compra 1 nível a cada 20 s.' },
      { cost: 25, delayMs: 10_000, line: 'Compra 1 nível a cada 10 s.' },
      { cost: 100, delayMs: 5_000, line: 'Compra 1 nível a cada 5 s.' },
      { cost: 400, delayMs: 2_500, line: 'Compra 1 nível a cada 2,5 s.' },
    ],
  },
  {
    id: 'seguranca',
    name: 'Monitor de Segurança',
    emoji: '🛡️',
    description: 'Defende a invasão se você demorar, por parte do prêmio. Não entra na sua sequência nem nas conquistas de defesa.',
    levels: [
      { cost: 8, delayMs: 5_000, share: 0.35, line: 'Entra após 5 s e leva 35% do prêmio.' },
      { cost: 35, delayMs: 4_000, share: 0.5, line: 'Entra após 4 s e leva 50% do prêmio.' },
      { cost: 140, delayMs: 3_000, share: 0.65, line: 'Entra após 3 s e leva 65% do prêmio.' },
      { cost: 500, delayMs: 2_000, share: 0.8, line: 'Entra após 2 s e leva 80% do prêmio.' },
    ],
  },
  {
    id: 'sprints',
    name: 'Monitor de Sprints',
    emoji: '📋',
    description: 'Aceita uma sprint quando as ofertas aparecem. Cumprir a meta continua com você, e sprint dele que vence não conta como perdida.',
    levels: [
      { cost: 12, delayMs: 30_000, line: 'Aceita uma oferta após 30 s.' },
      { cost: 45, delayMs: 15_000, line: 'Aceita uma oferta após 15 s.' },
      { cost: 170, delayMs: 6_000, line: 'Aceita uma oferta após 6 s.' },
      { cost: 600, delayMs: 2_000, line: 'Aceita uma oferta após 2 s.' },
    ],
  },
  {
    id: 'pesquisa',
    name: 'Monitor de Pesquisa',
    emoji: '🔬',
    description: 'Compra a pesquisa mais barata que couber no limite que você definir. Pesquisa dele não conta para a conquista de comprar pesquisas.',
    levels: [
      { cost: 10, delayMs: 30_000, line: 'Confere as pesquisas a cada 30 s.' },
      { cost: 40, delayMs: 15_000, line: 'Confere as pesquisas a cada 15 s.' },
      { cost: 150, delayMs: 8_000, line: 'Confere as pesquisas a cada 8 s.' },
      { cost: 550, delayMs: 4_000, line: 'Confere as pesquisas a cada 4 s.' },
    ],
  },
];
