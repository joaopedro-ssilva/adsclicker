/**
 * The Laboratório's own item bases: 24 more (6 per slot) that only drop in the advanced phases, with an RPG-meets-tech
 * look and a nod to the professors. Same shape as the Hackathon's bases (src/hackathon/content/items.ts); the effects
 * go through the same tables of content/lab.ts. Art lives in public/assets/lab/items/<id>.png.
 */
import type { LabAffixDef, LabBonus, LabItemBase, LabModifier, LabSetDef, LabSlot, LabUniqueEffect } from './labTypes';

/** First phase the advanced bases can drop in (the first boss is phase 5; the second one, phase 10, opens the next tier). */
export const LAB_ADVANCED_FROM = 8;
/** First phase of the best ones (the tier between is LAB_ADVANCED_FROM + 2, the second boss). */
export const LAB_LATE_FROM = 13;

const affix = (target: LabAffixDef['target'], op: 'add' | 'pct', min: number, max: number): LabAffixDef => ({ target, op, min, max });

/** Typical ranges at item level 1, a little above the Hackathon's: these come later. Kept inside the caps of lab.ts. */
const logica = affix('logica', 'add', 3, 5);
const logicaPct = affix('logica', 'pct', 5, 10);
const agilidade = affix('agilidade', 'add', 5, 9);
const foco = affix('foco', 'add', 20, 36);
const focoPct = affix('foco', 'pct', 4, 8);
const resiliencia = affix('resiliencia', 'add', 4, 7);
const resilienciaPct = affix('resiliencia', 'pct', 5, 9);
const atencao = affix('atencao', 'add', 3, 5);
const sorte = affix('sorte', 'add', 4, 8);
const dropExtra = affix('dropExtra', 'add', 2, 4);
const lootQuality = affix('lootQuality', 'add', 4, 8);
const commitsGain = affix('commitsGain', 'add', 5, 10);
const xpGain = affix('xpGain', 'add', 5, 10);
const bossDamage = affix('bossDamage', 'add', 5, 10);
const skillPower = affix('skillPower', 'add', 7, 14);
const cooldown = affix('cooldown', 'add', 5, 10);

const mods = (description: string, modifiers: LabModifier[]): LabUniqueEffect => ({ kind: 'modifiers', description, modifiers });
const skill = (description: string, id: string): LabUniqueEffect => ({ kind: 'skill', description, skill: id });

/** Lab-only "skills" of the advanced uniques: ids read by content/lab.ts through `skillBonuses`. */
export const labItemSkillBonuses: Record<string, LabBonus> = {
  'golpe-do-sir': { lab: { damage: 0.2 } },
  marretada: { lab: { bossDamage: 0.4 } },
  'arvore-binaria': { lab: { damage: 0.1, repairPhase: 0.03 } },
  espeto: { lab: { damage: 0.1, drain: -0.1 } },
  muralha: { lab: { drain: -0.25 } },
  'full-stack': { lab: { integrityPct: 0.2 } },
  sofa: { lab: { repairPhase: 0.05 } },
  forja: { lab: { damage: 0.12, drain: -0.08 } },
  anel: { lab: { damage: 0.25 } },
  backlog: { lab: { damage: 0.1, luck: 15 } },
  smash: { lab: { damage: 0.1, bossDamage: 0.3 } },
  overclock: { lab: { damage: 0.15, bossDamage: 0.15 } },
  alucinacao: { lab: { damage: 0.3, drain: 0.15 } },
  renascer: { lab: { secondWind: 1, repairBoss: 0.25 } },
};

function base(
  id: string,
  slot: LabSlot,
  fromPhase: number,
  name: string,
  emoji: string,
  description: string,
  primary: LabAffixDef,
  pool: LabAffixDef[],
  unique: LabUniqueEffect,
  set?: string,
): LabItemBase {
  return { id, slot, name, emoji, description, primary, pool, unique, ...(set ? { set } : {}), asset: `lab/items/${id}`, drops: true, affixes: true, fromPhase };
}

export const labItems: LabItemBase[] = [
  // ----- Ferramentas: armas -----
  base(
    'espada-do-sir-edecio', 'ferramenta', LAB_ADVANCED_FROM, 'Espada do Sir Edécio', '⚔️',
    'Aumenta o dano em %. Forjada na fornalha da Coordenação e afiada na ponta de uma caneta vermelha.',
    logicaPct, [atencao, bossDamage, agilidade, cooldown],
    skill('Por Edécio! +20% de dano automático.', 'golpe-do-sir'), 'guilda-dos-professores',
  ),
  base(
    'sabre-de-luz-do-glad', 'ferramenta', LAB_ADVANCED_FROM, 'Sabre de Luz do Darth Glad', '🗡️',
    'Aumenta a velocidade de ataque. Zumbe, brilha e já reprovou meia turma no lado sombrio da normalização.',
    agilidade, [logica, atencao, skillPower, bossDamage],
    { kind: 'critSplash', description: 'O lado sombrio do SQL: cada crítico tem 45% de chance de acertar todos os outros inimigos.', chance: 45 },
  ),
  base(
    'martelo-teclado-de-guerra', 'ferramenta', LAB_ADVANCED_FROM, 'Martelo-Teclado de Guerra', '🔨',
    'Aumenta a Lógica. Cada tecla é uma marretada, e o Enter derruba muralha.',
    logica, [agilidade, bossDamage, foco, xpGain],
    skill('Marretada de deploy: +40% de dano contra chefões.', 'marretada'),
  ),
  base(
    'cajado-do-mago-pablo', 'ferramenta', LAB_ADVANCED_FROM + 2, 'Cajado do Mago Pablo', '🪄',
    'Deixa as habilidades mais fortes. Na ponta, uma árvore binária que sempre se balanceia (menos na prova).',
    skillPower, [logica, cooldown, atencao, sorte, commitsGain],
    skill('Árvore binária: +10% de dano e repara 3% da integridade a cada fase.', 'arvore-binaria'),
  ),
  base(
    'pincel-arco-iris-da-b2', 'ferramenta', LAB_ADVANCED_FROM + 2, 'Pincel Arco-Íris da B2', '🖌️',
    'Aumenta a Atenção (crítico). Cada pincelada acerta o ponto exato, e o alinhamento é sempre perfeito.',
    atencao, [logica, sorte, lootQuality, agilidade],
    mods('Obra-prima: +25 de qualidade do loot.', [{ target: 'lootQuality', op: 'add', value: 25 }]),
  ),
  base(
    'espeto-sagrado-do-guto', 'ferramenta', LAB_LATE_FROM, 'Espeto Sagrado do Guto', '🍢',
    'Aumenta a velocidade de ataque. Fura bug, vira o frango e ainda serve de lanche no intervalo.',
    agilidade, [logica, foco, resiliencia, commitsGain],
    skill('Churrasco de plantão: +10% de dano e 10% menos integridade drenada.', 'espeto'),
  ),

  // ----- Setup: armaduras e estações -----
  base(
    'trono-do-reitor', 'setup', LAB_ADVANCED_FROM, 'Trono do Reitor Angelo', '🪑',
    'Aumenta o Foco (vida). Almofada de veludo, encosto dourado e um decreto para cada prazo.',
    foco, [resiliencia, cooldown, atencao, commitsGain],
    mods('Decreto da reitoria: +35% de Commits.', [{ target: 'xpGain', op: 'add', value: 35 }]), 'guilda-dos-professores',
  ),
  base(
    'servidor-fortaleza', 'setup', LAB_ADVANCED_FROM, 'Servidor Fortaleza do Wagner', '🏰',
    'Aumenta a Resiliência. Um rack com ameias, fosso de cabos e uma ponte levadiça que só abre com senha.',
    resiliencia, [foco, cooldown, atencao, xpGain],
    skill('Firewall de pedra: 25% menos integridade drenada.', 'muralha'),
  ),
  base(
    'armadura-full-stack', 'setup', LAB_ADVANCED_FROM + 2, 'Armadura Full Stack', '🦾',
    'Aumenta a vida em %. Placas de front-end, malha de back-end e uma cota de banco de dados.',
    focoPct, [resiliencia, atencao, skillPower, logica],
    skill('Pilha completa: +20% de integridade máxima.', 'full-stack'),
  ),
  base(
    'mesa-redonda-scrum', 'setup', LAB_ADVANCED_FROM + 2, 'Mesa Redonda do Scrum', '🛡️',
    'Aumenta a chance de item extra. Os cavaleiros do sprint nunca brigam, só estimam pontos.',
    dropExtra, [foco, resiliencia, sorte, xpGain, lootQuality],
    mods('Cavaleiros do sprint: +15% de chance de item extra e +15 de qualidade do loot.', [
      { target: 'dropExtra', op: 'add', value: 15 },
      { target: 'lootQuality', op: 'add', value: 15 },
    ]),
  ),
  base(
    'sofa-do-plantao', 'setup', LAB_LATE_FROM, 'Sofá do Plantão Eterno', '🛋️',
    'Aumenta o Foco (vida). Afunda um pouco, e quem senta dá só um cochilo rapidinho (três horas).',
    foco, [resiliencia, atencao, cooldown, sorte],
    skill('Cochilo estratégico: repara 5% da integridade a cada fase.', 'sofa'),
  ),
  base(
    'forja-de-silicio', 'setup', LAB_LATE_FROM, 'Forja de Silício do Glad', '⚒️',
    'Aumenta a Resiliência (menos dano). Bancada de solda, bigorna e um ferro que nunca esfria.',
    resilienciaPct, [foco, cooldown, logica, skillPower],
    skill('Soldado a quente: +12% de dano automático e 8% menos integridade drenada.', 'forja'),
  ),

  // ----- Acessórios: anéis, capas e escudos -----
  base(
    'escudo-firewall-do-wagner', 'acessorio', LAB_ADVANCED_FROM, 'Escudo Firewall do Wagner', '🛡️',
    'Aumenta a Resiliência em %. Bloqueia tudo, inclusive o que você pediu por e-mail.',
    resilienciaPct, [foco, atencao, cooldown, sorte],
    { kind: 'secondWind', description: 'Porta fechada: uma vez por fase, um golpe que derrubaria o monitor deixa 15% de integridade.' },
    'guilda-dos-professores',
  ),
  base(
    'botas-de-entrega-continua', 'acessorio', LAB_ADVANCED_FROM, 'Botas de Entrega Contínua', '🥾',
    'Aumenta a velocidade de ataque. Cada passo é um deploy, e nenhum pisa na sexta-feira.',
    agilidade, [foco, resiliencia, cooldown, xpGain],
    mods('Pipeline nos pés: +25% de velocidade de ataque e habilidades 15% mais rápidas.', [
      { target: 'agilidade', op: 'pct', value: 25 },
      { target: 'cooldown', op: 'add', value: 15 },
    ]),
  ),
  base(
    'capa-do-sudo-invisivel', 'acessorio', LAB_ADVANCED_FROM + 2, 'Capa do Sudo Invisível', '🧥',
    'Aumenta a Atenção (crítico). Ninguém vê quem mexeu em produção, nem o próprio dono da capa.',
    atencao, [agilidade, logica, sorte, lootQuality, xpGain],
    { kind: 'critSplash', description: 'sudo rm -rf bug: cada crítico tem 35% de chance de acertar todos os outros inimigos.', chance: 35 },
  ),
  base(
    'manoplas-do-product-owner', 'acessorio', LAB_ADVANCED_FROM + 2, 'Manoplas do Product Owner', '🧤',
    'Deixa as habilidades mais fortes. Prioriza o backlog com as próprias mãos (e com um soco).',
    skillPower, [logica, cooldown, atencao, commitsGain],
    skill('Backlog priorizado: +10% de dano e +15 de qualidade do loot.', 'backlog'),
  ),
  base(
    'anel-de-um-so-build', 'acessorio', LAB_LATE_FROM, 'Anel de Um Só Build', '💍',
    'Aumenta a Lógica. Um build para a todos governar, um build para a todos encontrar.',
    logica, [atencao, agilidade, cooldown, bossDamage],
    skill('Governa todos os módulos: +25% de dano automático.', 'anel'),
  ),
  base(
    'raquete-escudo-do-padel', 'acessorio', LAB_LATE_FROM, 'Raquete-Escudo do Padel', '🏓',
    'Aumenta a Atenção (crítico). Rebate bug na parede de vidro e ainda marca ponto.',
    atencao, [logica, agilidade, bossDamage, sorte],
    skill('Smash no chefão: +10% de dano e +30% de dano contra chefões.', 'smash'),
  ),

  // ----- Amuletos: relíquias -----
  base(
    'cristal-de-gpu', 'amuleto', LAB_ADVANCED_FROM + 2, 'Cristal de GPU', '💎',
    'Habilidades recarregam mais rápido. Brilha, esquenta e só aceita ser resfriado a líquido.',
    cooldown, [agilidade, skillPower, foco, sorte],
    skill('Overclock: +15% de dano automático e +15% de dano contra chefões.', 'overclock'),
  ),
  base(
    'grimorio-de-algoritmos', 'amuleto', LAB_ADVANCED_FROM, 'Grimório de Algoritmos', '📖',
    'Deixa as habilidades mais fortes. Cada página é uma complexidade, e a última é O(n!).',
    skillPower, [logica, atencao, cooldown, xpGain],
    mods('Notação antiga: +20% de Commits e +20 de qualidade do loot.', [
      { target: 'xpGain', op: 'add', value: 20 },
      { target: 'lootQuality', op: 'add', value: 20 },
    ]),
    'guilda-dos-professores',
  ),
  base(
    'olho-da-ia', 'amuleto', LAB_LATE_FROM, 'Olho da IA Onisciente', '👁️',
    'Aumenta a Atenção (crítico). Vê tudo, sabe tudo e responde com muita confiança (às vezes errado).',
    atencao, [logica, sorte, lootQuality, agilidade],
    skill('Alucina com confiança: +30% de dano automático, mas os mobs drenam 15% mais integridade.', 'alucinacao'),
  ),
  base(
    'pe-de-coelho-de-producao', 'amuleto', LAB_ADVANCED_FROM + 2, 'Pé de Coelho de Produção', '🐰',
    'Aumenta a Sorte. Funciona em produção, em homologação e naquele deploy que ninguém testou.',
    sorte, [lootQuality, dropExtra, atencao, resiliencia, xpGain],
    mods('Deu sorte: +30 de Sorte e +10% de chance de item extra.', [
      { target: 'sorte', op: 'add', value: 30 },
      { target: 'dropExtra', op: 'add', value: 10 },
    ]),
  ),
  base(
    'fenix-do-rollback', 'amuleto', LAB_LATE_FROM, 'Fênix do Rollback', '🔥',
    'Aumenta a vida em %. Morre no deploy e renasce no commit anterior, sem perder quase nada.',
    focoPct, [resiliencia, cooldown, sorte, xpGain],
    skill('Renasce das cinzas: uma vez por fase um golpe fatal deixa 15% de integridade, e cada chefão repara 25%.', 'renascer'),
  ),
  base(
    'dado-de-vinte-lados', 'amuleto', LAB_ADVANCED_FROM + 2, 'D20 do Mestre de Masmorra', '🎲',
    'Melhora a qualidade do loot. O mestre jura que rolou 20, e a ficha confere.',
    lootQuality, [sorte, dropExtra, atencao, commitsGain],
    { kind: 'critSplash', description: 'Crítico natural: cada crítico tem 50% de chance de acertar todos os outros inimigos.', chance: 50 },
  ),
];

export const labItemSets: LabSetDef[] = [
  {
    id: 'guilda-dos-professores',
    name: 'Guilda dos Professores',
    bonuses: [
      {
        pieces: 2,
        description: '+10% de dano e +10% de vida máxima.',
        modifiers: [
          { target: 'logica', op: 'pct', value: 10 },
          { target: 'foco', op: 'pct', value: 10 },
        ],
      },
      {
        pieces: 4,
        description: 'Habilidades 30% mais fortes, +25% de Commits e +15 de qualidade do loot. A turma inteira do seu lado!',
        modifiers: [
          { target: 'skillPower', op: 'add', value: 30 },
          { target: 'xpGain', op: 'add', value: 25 },
          { target: 'lootQuality', op: 'add', value: 15 },
        ],
      },
    ],
  },
];
