/**
 * The permanent tree of the Laboratório, bought with Commits (docs/LABORATORIO.md). Three branches of eleven or twelve
 * nodes, three to five tiers deep, each tier needing a node of the one before it. A level costs `cost x costGrowth ^ level`;
 * every price goes through TREE_PRICE, the one knob that keeps the whole tree at the right distance from the Commits a run
 * pays (about 15 000 Commits to buy everything, which a good player earns in 40 to 80 runs).
 */
import type { LabBranch, LabEffects, LabNodeDef } from './labTypes';
import type { StatKey } from './types';

/** Version of the tree below. Bump it when a node is renamed, removed or repriced: older saves get their Commits back. */
export const LAB_TREE_VERSION = 1;

/** Multiplier on the Commits of every node (the price list below is written at 1). */
export const TREE_PRICE = 1;

const BRANCH_COL: Record<LabBranch, number> = { codigo: 0, infra: 4, produto: 8 };

interface NodeSpec {
  id: string;
  name: string;
  emoji: string;
  description: string;
  /** Commits of the first level, and the growth per level owned. */
  cost: number;
  growth?: number;
  max?: number;
  effects?: LabEffects;
  clicker?: { stat: StatKey; per: number }[];
  requires?: string[];
  /** Column inside the branch (0..3) and tier (row). */
  at: [number, number];
}

function branch(id: LabBranch, specs: NodeSpec[]): LabNodeDef[] {
  return specs.map((spec): LabNodeDef => {
    const node: LabNodeDef = {
      id: spec.id,
      branch: id,
      name: spec.name,
      emoji: spec.emoji,
      description: spec.description,
      cost: Math.max(1, Math.round(spec.cost * TREE_PRICE)),
      costGrowth: spec.growth ?? 1,
      maxLevel: spec.max ?? 1,
      effects: spec.effects ?? {},
      requires: spec.requires ?? [],
      position: { col: BRANCH_COL[id] + spec.at[0], row: spec.at[1] },
    };
    if (spec.clicker) node.clicker = spec.clicker;
    return node;
  });
}

const codigo = branch('codigo', [
  { id: 'algoritmos-eficientes', name: 'Algoritmos eficientes', emoji: '🧠', description: '+6% de dano automático por nível.', cost: 12, growth: 1.45, max: 10, effects: { damage: 0.06 }, at: [0, 0] },
  { id: 'estudo-de-chefao', name: 'Estudo de chefão', emoji: '📖', description: '+12% de dano em chefões por nível.', cost: 25, growth: 1.5, max: 6, effects: { bossDamage: 0.12 }, requires: ['algoritmos-eficientes'], at: [0, 1] },
  { id: 'setup-de-casa', name: 'Setup de casa', emoji: '🪑', description: 'Toda corrida começa com um item comum no Setup, além do mouse quebrado.', cost: 60, effects: { startSetup: 1 }, requires: ['algoritmos-eficientes'], at: [1, 1] },
  { id: 'minimalismo', name: 'Minimalismo', emoji: '✂️', description: '+10% de dano automático por espaço vazio, por nível. Quem tem pouco ainda ataca.', cost: 40, growth: 1.8, max: 3, effects: { emptySlotDamage: 0.1 }, requires: ['algoritmos-eficientes'], at: [2, 1] },
  { id: 'hotfix', name: 'Hotfix', emoji: '⚡', description: '+6 segundos no prazo do primeiro chefão de cada corrida, por nível.', cost: 90, growth: 1.7, max: 3, effects: { firstBossTime: 6 }, requires: ['estudo-de-chefao'], at: [0, 2] },
  { id: 'tdd', name: 'TDD', emoji: '🧪', description: 'Cada chefão derrotado paga +15 Commits na hora, por nível.', cost: 80, growth: 1.6, max: 4, effects: { bossCommits: 15 }, requires: ['estudo-de-chefao'], at: [1, 2] },
  { id: 'speedrun', name: 'Speedrun', emoji: '🏃', description: 'Vencer uma fase comum em menos de 10 s repara 2% da integridade, por nível.', cost: 70, growth: 1.6, max: 4, effects: { fastClearRepair: 0.02 }, requires: ['minimalismo'], at: [2, 2] },
  { id: 'estagiario-dedicado', name: 'Estagiário dedicado', emoji: '🎒', description: 'A corrida começa com +1 item incomum sorteado num espaço vazio, por nível.', cost: 260, growth: 3, max: 2, effects: { startItem: 1 }, requires: ['setup-de-casa'], at: [1, 3] },
  { id: 'heranca-de-codigo', name: 'Herança de código', emoji: '🧬', description: 'O item novo herda 30% do nível do que ele substitui, por nível.', cost: 420, growth: 2.2, max: 3, effects: { levelKeep: 0.3 }, requires: ['estagiario-dedicado'], at: [1, 4] },
  { id: 'codigo-lendario', name: 'Código lendário', emoji: '🏆', description: '+50% de dano automático por item lendário equipado, por nível.', cost: 500, growth: 2, max: 3, effects: { legendaryDamage: 0.5 }, requires: ['hotfix'], at: [0, 3] },
  { id: 'deploy-continuo', name: 'Deploy contínuo', emoji: '🚀', description: '+80% de dano automático e +60% em chefões. Pede Código lendário e Rede segura.', cost: 4200, effects: { damage: 0.8, bossDamage: 0.6 }, requires: ['codigo-lendario', 'rede-segura'], at: [0, 4] },
]);

const infra = branch('infra', [
  { id: 'monitor-reforcado', name: 'Monitor reforçado', emoji: '🖥️', description: '+8 de integridade máxima por nível.', cost: 10, growth: 1.38, max: 10, effects: { integrityFlat: 8 }, at: [0, 0] },
  { id: 'backup-noturno', name: 'Backup noturno', emoji: '💾', description: 'Repara 5% da integridade depois de cada chefão, por nível.', cost: 25, growth: 1.55, max: 5, effects: { repairBoss: 0.05 }, requires: ['monitor-reforcado'], at: [0, 1] },
  { id: 'prazo-folgado', name: 'Prazo folgado', emoji: '⏱️', description: '+4 segundos no prazo dos chefões por nível.', cost: 30, growth: 1.6, max: 5, effects: { bossTime: 4 }, requires: ['monitor-reforcado'], at: [1, 1] },
  { id: 'cooler-turbinado', name: 'Cooler turbinado', emoji: '❄️', description: 'Repara 1% da integridade depois de cada fase, por nível.', cost: 20, growth: 1.5, max: 5, effects: { repairPhase: 0.01 }, requires: ['monitor-reforcado'], at: [2, 1] },
  { id: 'rede-segura', name: 'Rede segura', emoji: '🔒', description: 'Os mobs drenam 3% menos integridade por nível.', cost: 40, growth: 1.55, max: 6, effects: { drain: -0.03 }, requires: ['backup-noturno'], at: [0, 2] },
  { id: 'nobreak-do-lab', name: 'Nobreak do laboratório', emoji: '🔋', description: 'Uma vez por fase, uma queda fatal deixa o monitor com 15% de integridade.', cost: 450, effects: { secondWind: 1 }, requires: ['prazo-folgado'], at: [1, 2] },
  { id: 'firewall-do-lab', name: 'Firewall do lab', emoji: '🧱', description: 'Toda fase começa com um escudo de 6% da integridade máxima, por nível.', cost: 55, growth: 1.7, max: 4, effects: { phaseShield: 0.06 }, requires: ['cooler-turbinado'], at: [2, 2] },
  { id: 'monitor-ultrawide', name: 'Monitor ultrawide', emoji: '📺', description: '+4% de integridade máxima por nível.', cost: 70, growth: 1.6, max: 5, effects: { integrityPct: 0.04 }, requires: ['firewall-do-lab'], at: [2, 3] },
  { id: 'zero-trust', name: 'Zero trust', emoji: '🛡️', description: 'Mais 4% de redução do dreno por nível, somando com a Rede segura.', cost: 220, growth: 1.9, max: 4, effects: { drain: -0.04 }, requires: ['rede-segura'], at: [0, 3] },
  { id: 'gerador-de-emergencia', name: 'Gerador de emergência', emoji: '🔌', description: 'Mais uma carga de segundo fôlego por fase.', cost: 1800, effects: { secondWind: 1 }, requires: ['nobreak-do-lab'], at: [1, 3] },
  { id: 'datacenter-proprio', name: 'Datacenter próprio', emoji: '🏢', description: '+25% de integridade máxima, +3% de reparo por fase e +10% após chefões. Pede Zero trust e Portfólio.', cost: 3600, effects: { integrityPct: 0.25, repairPhase: 0.03, repairBoss: 0.1 }, requires: ['zero-trust', 'portfolio-do-lab'], at: [0, 4] },
]);

const produto = branch('produto', [
  { id: 'revisao-de-pr', name: 'Revisão de PR', emoji: '🔍', description: 'A primeira recompensa da corrida mostra 4 opções.', cost: 30, effects: { firstOptions: 1 }, at: [0, 0] },
  { id: 'codigo-limpo', name: 'Código limpo', emoji: '✨', description: '+4 de sorte por nível: mais chance de itens raros e lendários.', cost: 15, growth: 1.5, max: 8, effects: { luck: 4 }, requires: ['revisao-de-pr'], at: [0, 1] },
  { id: 'documentacao', name: 'Documentação', emoji: '📚', description: 'Os buffs do Laboratório valem 8% mais no clicker, por nível.', cost: 20, growth: 1.55, max: 5, effects: { clicker: 0.08 }, requires: ['revisao-de-pr'], at: [1, 1] },
  { id: 'retrospectiva', name: 'Retrospectiva', emoji: '🔁', description: 'Sorteia de novo as opções de cada recompensa, uma vez por nível.', cost: 300, growth: 3.5, max: 2, effects: { offerRerolls: 1 }, requires: ['revisao-de-pr'], at: [2, 1] },
  { id: 'portfolio-do-lab', name: 'Portfólio', emoji: '📁', description: '+12% de Commits por nível.', cost: 40, growth: 1.7, max: 5, effects: { commits: 0.12 }, requires: ['codigo-limpo'], at: [0, 2] },
  { id: 'reciclagem', name: 'Reciclagem', emoji: '♻️', description: 'Itens reciclados pagam 20% mais Commits, por nível.', cost: 45, growth: 1.6, max: 5, effects: { recycleBonus: 0.2 }, requires: ['codigo-limpo'], at: [0, 3] },
  { id: 'mouse-gamer', name: 'Mouse gamer', emoji: '🖱️', description: '+4% de ADScoins por clique no clicker, por nível.', cost: 25, growth: 1.5, max: 5, clicker: [{ stat: 'clickPower', per: 0.04 }], requires: ['documentacao'], at: [1, 2] },
  { id: 'cafeina', name: 'Cafeína', emoji: '☕', description: 'Habilidades dos professores recarregam 2% mais rápido, por nível.', cost: 35, growth: 1.55, max: 5, clicker: [{ stat: 'abilityCooldown', per: -0.02 }], requires: ['documentacao'], at: [2, 2] },
  { id: 'licencas-educacionais', name: 'Licenças educacionais', emoji: '🏷️', description: 'Subir o nível de itens com ADScoins custa 8% menos, por nível.', cost: 60, growth: 1.65, max: 5, effects: { levelCost: -0.08 }, requires: ['documentacao'], at: [3, 2] },
  { id: 'mira-afiada', name: 'Mira afiada', emoji: '🎯', description: '+1,5 ponto de chance de crítico no clicker, por nível.', cost: 45, growth: 1.6, max: 4, clicker: [{ stat: 'critChance', per: 0.015 }], requires: ['mouse-gamer'], at: [1, 3] },
  { id: 'mentoria', name: 'Mentoria', emoji: '🎓', description: 'A recompensa de um chefão mostra uma opção a mais.', cost: 700, effects: { bossOptions: 1 }, requires: ['retrospectiva'], at: [2, 3] },
  { id: 'unicornio', name: 'Unicórnio', emoji: '🦄', description: '+15 de sorte, +30% de Commits e +10% de chance de opção extra. Pede Portfólio e TDD.', cost: 4800, effects: { luck: 15, commits: 0.3, extraOption: 10 }, requires: ['portfolio-do-lab', 'tdd'], at: [0, 4] },
]);

export const labTree: LabNodeDef[] = [...codigo, ...infra, ...produto];

/**
 * Tree of the saves before versioning (version 0, 12 nodes): only the prices, to give the Commits back to a player who
 * bought them. Every node of an older version is refunded, even the ones that still exist.
 */
export const legacyTree: Record<number, Record<string, { cost: number; costGrowth: number; maxLevel: number }>> = {
  0: {
    'algoritmos-eficientes': { cost: 8, costGrowth: 1.4, maxLevel: 10 },
    'estudo-de-chefao': { cost: 12, costGrowth: 1.5, maxLevel: 5 },
    'setup-de-casa': { cost: 25, costGrowth: 1, maxLevel: 1 },
    'monitor-reforcado': { cost: 6, costGrowth: 1.35, maxLevel: 10 },
    'backup-noturno': { cost: 14, costGrowth: 1.5, maxLevel: 5 },
    'prazo-folgado': { cost: 20, costGrowth: 1.7, maxLevel: 4 },
    'rede-segura': { cost: 12, costGrowth: 1.45, maxLevel: 5 },
    'nobreak-do-lab': { cost: 60, costGrowth: 1, maxLevel: 1 },
    'revisao-de-pr': { cost: 20, costGrowth: 1, maxLevel: 1 },
    'codigo-limpo': { cost: 10, costGrowth: 1.4, maxLevel: 6 },
    documentacao: { cost: 15, costGrowth: 1.5, maxLevel: 5 },
    'portfolio-do-lab': { cost: 30, costGrowth: 1.8, maxLevel: 3 },
  },
};
