import type { AffixDef, ItemBaseDef, ItemSetDef, MetaId, StatId } from './types';

const affix = (target: StatId | MetaId, op: 'add' | 'pct', min: number, max: number): AffixDef => ({
  target,
  op,
  min,
  max,
});

/** Typical ranges at item level 1 (before rarity and level multipliers). */
const logica = affix('logica', 'add', 2, 4);
const agilidade = affix('agilidade', 'add', 4, 8);
const foco = affix('foco', 'add', 15, 30);
const focoPct = affix('foco', 'pct', 3, 6);
const resiliencia = affix('resiliencia', 'add', 3, 6);
const atencao = affix('atencao', 'add', 2, 4);
const sorte = affix('sorte', 'add', 3, 6);
const dropExtra = affix('dropExtra', 'add', 2, 4);
const lootQuality = affix('lootQuality', 'add', 3, 6);
const commitsGain = affix('commitsGain', 'add', 4, 8);
const xpGain = affix('xpGain', 'add', 4, 8);
const bossDamage = affix('bossDamage', 'add', 4, 8);
const skillPower = affix('skillPower', 'add', 5, 10);
const cooldown = affix('cooldown', 'add', 4, 8);

export const items: ItemBaseDef[] = [
  // ----- Ferramentas: ataque -----
  {
    id: 'teclado-mecanico',
    slot: 'ferramenta',
    name: 'Teclado mecânico',
    emoji: '⌨️',
    description: 'Aumenta a velocidade de ataque. Cada tecla é um golpe, e os vizinhos ouvem todos.',
    primary: agilidade,
    pool: [logica, atencao, bossDamage, xpGain],
    unique: {
      kind: 'modifiers',
      description: 'Tec-tec-tec: +20% de velocidade de ataque.',
      modifiers: [{ target: 'agilidade', op: 'pct', value: 20 }],
    },
    asset: 'hackathon/items/teclado-mecanico',
  },
  {
    id: 'notebook-velho',
    slot: 'ferramenta',
    name: 'Notebook velho',
    emoji: '💻',
    description: 'Aumenta a Lógica (dano por golpe). Demora uma eternidade para ligar, mas aguenta tudo.',
    primary: logica,
    pool: [focoPct, atencao, agilidade, skillPower, cooldown],
    unique: {
      kind: 'skill',
      description: 'Compila na nuvem: você ganha a habilidade Deploy, mesmo sem a ter na árvore.',
      skill: 'deploy',
    },
    asset: 'hackathon/items/notebook-velho',
  },
  {
    id: 'mouse-vertical',
    slot: 'ferramenta',
    name: 'Mouse vertical',
    emoji: '🖱️',
    description: 'Aumenta a Atenção (chance de crítico). O pulso agradece, os inimigos nem tanto.',
    primary: atencao,
    pool: [logica, agilidade, sorte, commitsGain, bossDamage],
    unique: {
      kind: 'critSplash',
      description: 'Clique certeiro: cada crítico tem 30% de chance de acertar todos os outros inimigos também.',
      chance: 30,
    },
    asset: 'hackathon/items/mouse-vertical',
  },
  {
    id: 'editor-escuro',
    slot: 'ferramenta',
    name: 'Editor em modo escuro',
    emoji: '🌑',
    description: 'Aumenta o dano em %. Código fica mais bonito no escuro e ninguém precisa de luz.',
    primary: affix('logica', 'pct', 4, 8),
    pool: [atencao, skillPower, cooldown, xpGain, agilidade],
    unique: {
      kind: 'modifiers',
      description: 'Tema Dracula: habilidades 20% mais fortes e 10% mais rápidas de recarregar.',
      modifiers: [
        { target: 'skillPower', op: 'add', value: 20 },
        { target: 'cooldown', op: 'add', value: 10 },
      ],
    },
    set: 'kit-plantao',
    asset: 'hackathon/items/editor-escuro',
  },
  {
    id: 'terminal-hacker',
    slot: 'ferramenta',
    name: 'Terminal com atalhos',
    emoji: '🐧',
    description: 'Deixa as habilidades mais fortes. Um comando e pronto (se lembrar qual).',
    primary: skillPower,
    pool: [logica, agilidade, cooldown, atencao, bossDamage],
    unique: {
      kind: 'modifiers',
      description: 'sudo vencer: +15% de dano e +10% de dano contra chefões.',
      modifiers: [
        { target: 'logica', op: 'pct', value: 15 },
        { target: 'bossDamage', op: 'add', value: 10 },
      ],
    },
    asset: 'hackathon/items/terminal-hacker',
  },
  {
    id: 'calculadora-cientifica',
    slot: 'ferramenta',
    name: 'Calculadora científica',
    emoji: '🧮',
    description: 'Aumenta a Lógica. Para quem prefere contar o dano na ponta do lápis.',
    primary: affix('logica', 'add', 3, 5),
    pool: [atencao, foco, bossDamage, sorte],
    unique: {
      kind: 'critSplash',
      description: 'Raiz quadrada do estrago: cada crítico tem 25% de chance de acertar todos os outros inimigos.',
      chance: 25,
    },
    asset: 'hackathon/items/calculadora-cientifica',
  },

  // ----- Setup: vida e defesa -----
  {
    id: 'cadeira-ergonomica',
    slot: 'setup',
    name: 'Cadeira ergonômica',
    emoji: '🪑',
    description: 'Aumenta o Foco (vida). A coluna dura mais que o prazo.',
    primary: foco,
    pool: [resiliencia, cooldown, atencao],
    unique: {
      kind: 'modifiers',
      description: 'Postura de campeão: +20% de vida máxima e +8 de Resiliência.',
      modifiers: [
        { target: 'foco', op: 'pct', value: 20 },
        { target: 'resiliencia', op: 'add', value: 8 },
      ],
    },
    set: 'kit-plantao',
    asset: 'hackathon/items/cadeira-ergonomica',
  },
  {
    id: 'monitor-ultrawide',
    slot: 'setup',
    name: 'Monitor ultrawide',
    emoji: '🖥️',
    description: 'Aumenta a vida em %. Cabem vinte abas, três terminais e um bug gigante.',
    primary: focoPct,
    pool: [atencao, lootQuality, resiliencia, sorte, xpGain],
    unique: {
      kind: 'modifiers',
      description: 'Visão ampla: +6 de Atenção e +10% de qualidade do loot.',
      modifiers: [
        { target: 'atencao', op: 'add', value: 6 },
        { target: 'lootQuality', op: 'add', value: 10 },
      ],
    },
    asset: 'hackathon/items/monitor-ultrawide',
  },
  {
    id: 'mesa-regulavel',
    slot: 'setup',
    name: 'Mesa de altura regulável',
    emoji: '🗃️',
    description: 'Aumenta a Resiliência (menos dano). Trabalhar em pé também é resistência.',
    primary: resiliencia,
    pool: [foco, agilidade, commitsGain],
    unique: {
      kind: 'modifiers',
      description: 'Nível máximo: +25 de Resiliência e +10% de vida máxima.',
      modifiers: [
        { target: 'resiliencia', op: 'add', value: 25 },
        { target: 'foco', op: 'pct', value: 10 },
      ],
    },
    asset: 'hackathon/items/mesa-regulavel',
  },
  {
    id: 'luminaria-de-mesa',
    slot: 'setup',
    name: 'Luminária de mesa',
    emoji: '💡',
    description: 'Aumenta o Foco (vida). Ideia brilhante, literalmente.',
    primary: foco,
    pool: [resiliencia, atencao, skillPower, cooldown],
    unique: {
      kind: 'skill',
      description: 'Ideia na cabeça: você ganha a habilidade Refatorar, mesmo sem a ter na árvore.',
      skill: 'refatorar',
    },
    asset: 'hackathon/items/luminaria-de-mesa',
  },
  {
    id: 'ventilador-de-mesa',
    slot: 'setup',
    name: 'Ventilador de mesa',
    emoji: '🌀',
    description: 'Aumenta a Resiliência. Esfria o notebook e a cabeça.',
    primary: affix('resiliencia', 'add', 2, 5),
    pool: [foco, cooldown, agilidade, sorte, xpGain],
    unique: {
      kind: 'modifiers',
      description: 'Ar fresco: habilidades recarregam 20% mais rápido.',
      modifiers: [{ target: 'cooldown', op: 'add', value: 20 }],
    },
    asset: 'hackathon/items/ventilador-de-mesa',
  },
  {
    id: 'nobreak',
    slot: 'setup',
    name: 'Nobreak',
    emoji: '🔋',
    description: 'Aumenta o Foco (vida). Quando a luz cai, o código não perde o save.',
    primary: affix('foco', 'add', 20, 35),
    pool: [resiliencia, atencao, commitsGain],
    unique: {
      kind: 'secondWind',
      description: 'Bateria reserva: uma vez por fase, um golpe que mataria deixa você com 1 de vida.',
    },
    asset: 'hackathon/items/nobreak',
  },

  // ----- Acessórios: utilidade -----
  {
    id: 'fone-cancelamento',
    slot: 'acessorio',
    name: 'Fone com cancelamento de ruído',
    emoji: '🎧',
    description: 'Aumenta a Resiliência. Só ouve o que importa (a trilha sonora).',
    primary: resiliencia,
    pool: [foco, atencao, cooldown, xpGain],
    unique: {
      kind: 'modifiers',
      description: 'Modo foco: +10% de vida máxima e +5 de Atenção.',
      modifiers: [
        { target: 'foco', op: 'pct', value: 10 },
        { target: 'atencao', op: 'add', value: 5 },
      ],
    },
    set: 'kit-plantao',
    asset: 'hackathon/items/fone-cancelamento',
  },
  {
    id: 'mochila-de-notebook',
    slot: 'acessorio',
    name: 'Mochila de notebook',
    emoji: '🎒',
    description: 'Aumenta a chance de item extra. Cabe notebook, carregador e mais um item.',
    primary: dropExtra,
    pool: [foco, resiliencia, sorte, commitsGain, xpGain],
    unique: {
      kind: 'modifiers',
      description: 'Bolso secreto: +10% de chance de item extra e +10% de Commits.',
      modifiers: [
        { target: 'dropExtra', op: 'add', value: 10 },
        { target: 'commitsGain', op: 'add', value: 10 },
      ],
    },
    asset: 'hackathon/items/mochila-de-notebook',
  },
  {
    id: 'cracha-do-hackathon',
    slot: 'acessorio',
    name: 'Crachá do hackathon',
    emoji: '🪪',
    description: 'Melhora a qualidade do loot. Com crachá, entra em qualquer sala.',
    primary: lootQuality,
    pool: [resiliencia, foco, sorte, commitsGain, xpGain],
    unique: {
      kind: 'skill',
      description: 'Acesso liberado: você ganha a habilidade Firewall, mesmo sem a ter na árvore.',
      skill: 'firewall',
    },
    asset: 'hackathon/items/cracha-do-hackathon',
  },
  {
    id: 'camiseta-do-evento',
    slot: 'acessorio',
    name: 'Camiseta do evento',
    emoji: '👕',
    description: 'Aumenta o XP ganho. Quem veste a camisa aprende mais rápido.',
    primary: xpGain,
    pool: [foco, resiliencia, commitsGain, sorte, lootQuality],
    unique: {
      kind: 'modifiers',
      description: 'Camisa de veterano: +20% de XP e +10% de Commits.',
      modifiers: [
        { target: 'xpGain', op: 'add', value: 20 },
        { target: 'commitsGain', op: 'add', value: 10 },
      ],
    },
    asset: 'hackathon/items/camiseta-do-evento',
  },
  {
    id: 'oculos-luz-azul',
    slot: 'acessorio',
    name: 'Óculos anti-luz azul',
    emoji: '🕶️',
    description: 'Aumenta a Atenção (crítico). Você vê o bug antes de ele te ver.',
    primary: affix('atencao', 'add', 2, 5),
    pool: [logica, agilidade, sorte, lootQuality, focoPct],
    unique: {
      kind: 'critSplash',
      description: 'Visão de raio X: cada crítico tem 20% de chance de acertar todos os outros inimigos.',
      chance: 20,
    },
    asset: 'hackathon/items/oculos-luz-azul',
  },
  {
    id: 'relogio-de-ponto',
    slot: 'acessorio',
    name: 'Relógio de ponto',
    emoji: '⌚',
    description: 'Habilidades recarregam mais rápido. Cada segundo conta (e é contado).',
    primary: cooldown,
    pool: [agilidade, foco, atencao, skillPower, xpGain],
    unique: {
      kind: 'modifiers',
      description: 'Hora extra: +12% de velocidade de ataque e habilidades 10% mais rápidas.',
      modifiers: [
        { target: 'agilidade', op: 'pct', value: 12 },
        { target: 'cooldown', op: 'add', value: 10 },
      ],
    },
    asset: 'hackathon/items/relogio-de-ponto',
  },

  // ----- Amuletos: sorte e utilidade -----
  {
    id: 'caneca-termica',
    slot: 'amuleto',
    name: 'Caneca térmica',
    emoji: '☕',
    description: 'Habilidades recarregam mais rápido. O café esfria devagar; o prazo, rápido.',
    primary: cooldown,
    pool: [agilidade, foco, atencao, skillPower, sorte],
    unique: {
      kind: 'skill',
      description: 'Refil infinito: você ganha a habilidade Café duplo, mesmo sem a ter na árvore.',
      skill: 'cafe-duplo',
    },
    set: 'kit-plantao',
    asset: 'hackathon/items/caneca-termica',
  },
  {
    id: 'pato-de-borracha',
    slot: 'amuleto',
    name: 'Pato de borracha',
    emoji: '🦆',
    description: 'Aumenta a Sorte. Explique o problema ao pato e a solução aparece.',
    primary: sorte,
    pool: [lootQuality, atencao, dropExtra, resiliencia, xpGain],
    unique: {
      kind: 'secondWind',
      description: 'Debug de emergência: uma vez por fase, um golpe que mataria deixa você com 1 de vida.',
    },
    asset: 'hackathon/items/pato-de-borracha',
  },
  {
    id: 'adesivo-de-linguagem',
    slot: 'amuleto',
    name: 'Adesivo de linguagem',
    emoji: '🏷️',
    description: 'Deixa as habilidades mais fortes. Cola no notebook e você já é fluente.',
    primary: skillPower,
    pool: [logica, atencao, cooldown, sorte, commitsGain],
    unique: {
      kind: 'modifiers',
      description: 'Fluência total: +10% de dano e +4 de Atenção.',
      modifiers: [
        { target: 'logica', op: 'pct', value: 10 },
        { target: 'atencao', op: 'add', value: 4 },
      ],
    },
    asset: 'hackathon/items/adesivo-de-linguagem',
  },
  {
    id: 'moeda-de-um-commit',
    slot: 'amuleto',
    name: 'Moeda de um commit',
    emoji: '🪙',
    description: 'Aumenta os Commits ganhos. Pequena, mas você jura que vale muito.',
    primary: commitsGain,
    pool: [sorte, lootQuality, xpGain, foco, resiliencia],
    unique: {
      kind: 'modifiers',
      description: 'Rendimento composto: +25% de Commits ganhos.',
      modifiers: [{ target: 'commitsGain', op: 'add', value: 25 }],
    },
    asset: 'hackathon/items/moeda-de-um-commit',
  },
  {
    id: 'trevo-de-quatro-folhas',
    slot: 'amuleto',
    name: 'Trevo de quatro folhas',
    emoji: '🍀',
    description: 'Aumenta a Sorte. Funciona também quando você esquece de salvar.',
    primary: affix('sorte', 'add', 4, 7),
    pool: [lootQuality, dropExtra, atencao, commitsGain],
    unique: {
      kind: 'modifiers',
      description: 'Quatro folhas, quatro lados: +20 de Sorte e +8% de chance de item extra.',
      modifiers: [
        { target: 'sorte', op: 'add', value: 20 },
        { target: 'dropExtra', op: 'add', value: 8 },
      ],
    },
    asset: 'hackathon/items/trevo-de-quatro-folhas',
  },
  {
    id: 'suculenta-de-mesa',
    slot: 'amuleto',
    name: 'Suculenta de mesa',
    emoji: '🌵',
    description: 'Aumenta a vida em %. Sobrevive a semanas sem rega, igual a você em semana de prova.',
    primary: focoPct,
    pool: [resiliencia, sorte, xpGain, cooldown],
    unique: {
      kind: 'secondWind',
      description: 'Resistência de cacto: uma vez por fase, um golpe que mataria deixa você com 1 de vida.',
    },
    asset: 'hackathon/items/suculenta-de-mesa',
  },
];

export const sets: ItemSetDef[] = [
  {
    id: 'kit-plantao',
    name: 'Kit Plantão',
    bonuses: [
      {
        pieces: 2,
        description: '+8% de dano e +8% de vida máxima.',
        modifiers: [
          { target: 'logica', op: 'pct', value: 8 },
          { target: 'foco', op: 'pct', value: 8 },
        ],
      },
      {
        pieces: 4,
        description: 'Habilidades 25% mais fortes, 15% mais rápidas de recarregar e +10 de Resiliência. Plantão completo!',
        modifiers: [
          { target: 'skillPower', op: 'add', value: 25 },
          { target: 'cooldown', op: 'add', value: 15 },
          { target: 'resiliencia', op: 'add', value: 10 },
        ],
      },
    ],
  },
];
