import type { AchievementDef, AchievementFamily, Condition, CounterKey, ProfessorId } from './types';

const counter = (key: CounterKey, gte: number): Condition => ({ kind: 'counter', counter: key, gte });
const hired = (professor: ProfessorId): Condition => ({ kind: 'professorHired', professor });
const allLevel = (professor: ProfessorId, level: number): Condition => ({ kind: 'allDisciplinesLevel', professor, level });
const allResearch = (professor: ProfessorId): Condition => ({ kind: 'allResearch', professor });

type Reward = NonNullable<AchievementDef['reward']>;

const ach = (
  id: string,
  family: AchievementFamily,
  name: string,
  emoji: string,
  description: string,
  condition: Condition,
  reward?: Reward,
  secret?: boolean,
): AchievementDef => ({
  id,
  family,
  name,
  emoji,
  description,
  ...(secret ? { secret: true } : {}),
  condition,
  ...(reward ? { reward } : {}),
});

/**
 * 93 achievements. Each gives +1% global production; some also grant a skin, scenery or theme.
 * Every non-default cosmetic is granted by exactly one achievement, and harder ones give rarer skins:
 * common = hire / early clicks, rare = discipline level 25, epic = all research, legendary = level 100.
 */
export const achievements: AchievementDef[] = [
  // ------------------------------------------------------------------ click (12)
  ach('click-100', 'click', 'Primeiros Joinhas', '👍', 'Dê 100 cliques.', counter('clicks', 100)),
  ach('click-500', 'click', 'Pegando o Jeito', '🖱️', 'Dê 500 cliques.', counter('clicks', 500)),
  ach('click-1k', 'click', 'Mil Joinhas', '☕', 'Dê 1.000 cliques. Merece um café.', counter('clicks', 1000), { skin: 'edecio-cafe' }),
  ach('click-5k', 'click', 'Dedo Calejado', '🤚', 'Dê 5.000 cliques.', counter('clicks', 5000), { skin: 'gladimir-dba' }),
  ach('click-10k', 'click', 'Rodando em Loop', '💻', 'Dê 10.000 cliques. O for não termina.', counter('clicks', 10000), {
    skin: 'edecio-programador',
  }),
  ach('click-50k', 'click', 'Meio Caminho Andado', '🏃', 'Dê 50.000 cliques.', counter('clicks', 50000)),
  ach('click-100k', 'click', 'Cem Mil Joinhas', '💪', 'Dê 100.000 cliques. Braço de aço.', counter('clicks', 100000), {
    skin: 'edecio-chad',
  }),
  ach('crit-10', 'click', 'Sorte de Principiante', '🍀', 'Acerte 10 críticos.', counter('crits', 10)),
  ach('crit-100', 'click', 'Cria da Sorte', '🤬', 'Acerte 100 críticos.', counter('crits', 100), { skin: 'edecio-cria' }),
  ach('crit-1000', 'click', 'Tudo de Diamante', '💎', 'Acerte 1.000 críticos.', counter('crits', 1000), {
    skin: 'edecio-full-dima',
  }),
  ach('combo-10', 'click', 'Embalando', '🔥', 'Chegue a um combo de 10 passos.', counter('maxCombo', 10)),
  ach('combo-20', 'click', 'Combo Cheio', '💥', 'Chegue a um combo de 20 passos.', counter('maxCombo', 20)),

  // ------------------------------------------------------------------ production (15)
  ach('coins-1e3', 'production', 'Troco de Cantina', '🪙', 'Ganhe 1.000 ADScoins no total.', { kind: 'lifetimeCoins', gte: '1e3' }),
  ach('coins-1e6', 'production', 'Primeiro Milhão', '🏝️', 'Ganhe 1 milhão de ADScoins no total.', { kind: 'lifetimeCoins', gte: '1e6' }, {
    scenery: 'praia',
  }),
  ach('coins-1e9', 'production', 'Capital da Cidade', '🏙️', 'Ganhe 1 bilhão de ADScoins no total.', { kind: 'lifetimeCoins', gte: '1e9' }, {
    scenery: 'cidade',
  }),
  ach('coins-1e12', 'production', 'Fundo do Nether', '🕳️', 'Ganhe 1 trilhão de ADScoins no total.', { kind: 'lifetimeCoins', gte: '1e12' }, {
    scenery: 'nether',
  }),
  ach('coins-1e15', 'production', 'Exílio Dourado', '🏜️', 'Ganhe 1 quatrilhão de ADScoins no total.', { kind: 'lifetimeCoins', gte: '1e15' }, {
    scenery: 'deserto',
  }),
  ach('coins-1e18', 'production', 'Paz do Templo', '🛕', 'Ganhe 1 quintilhão de ADScoins no total.', { kind: 'lifetimeCoins', gte: '1e18' }, {
    scenery: 'templo',
  }),
  ach('coins-1e21', 'production', 'Sextilhão no Bolso', '💰', 'Ganhe 1 sextilhão de ADScoins no total.', { kind: 'lifetimeCoins', gte: '1e21' }),
  ach('coins-1e24', 'production', 'Septilhão de Boas Notas', '🏦', 'Ganhe 1 septilhão de ADScoins no total.', { kind: 'lifetimeCoins', gte: '1e24' }),
  ach('cps-10', 'production', 'Tá Rendendo', '📈', 'Produza 10 ADScoins por segundo.', { kind: 'coinsPerSecond', gte: '10' }),
  ach('cps-100', 'production', 'Rato de Laboratório', '🖥️', 'Produza 100 ADScoins por segundo.', { kind: 'coinsPerSecond', gte: '100' }, {
    scenery: 'laboratorio',
  }),
  ach('cps-1e4', 'production', 'Casa que Trabalha Sozinha', '🏠', 'Produza 10.000 ADScoins por segundo.', { kind: 'coinsPerSecond', gte: '1e4' }, {
    scenery: 'casa-automatica',
  }),
  ach('cps-1e7', 'production', 'Dez Milhões por Segundo', '⚡', 'Produza 10 milhões de ADScoins por segundo.', { kind: 'coinsPerSecond', gte: '1e7' }),
  ach('cps-1e10', 'production', 'Cachoeira de ADScoins', '🌊', 'Produza 10 bilhões de ADScoins por segundo.', { kind: 'coinsPerSecond', gte: '1e10' }),
  ach('cps-1e13', 'production', 'Rack Cheio', '🗄️', 'Produza 10 trilhões de ADScoins por segundo.', { kind: 'coinsPerSecond', gte: '1e13' }, {
    scenery: 'datacenter',
  }),
  ach('research-1', 'production', 'Primeira Pesquisa', '💪', 'Compre a sua primeira pesquisa. Estudar também é treino.', counter('researchBought', 1), {
    scenery: 'academia',
  }),
  ach('research-10', 'production', 'Leitura Acessível', '🔬', 'Compre 10 pesquisas, somando todas as turmas.', counter('researchBought', 10), {
    theme: 'alto-contraste',
  }),

  // ------------------------------------------------------------------ professor (31)
  // Hiring: common skin
  ach('hire-gladimir', 'professor', 'Que o JOIN Esteja com Você', '🪐', 'Contrate o Gladimir.', hired('gladimir')),
  ach('hire-b2', 'professor', 'Interface Amigável', '🎨', 'Contrate a Bruna B2.', hired('b2'), { skin: 'b2-postit', theme: 'claro' }),
  ach('hire-wagner', 'professor', 'Rede Protegida', '🛡️', 'Contrate o Wagner.', hired('wagner'), { skin: 'wagner-hacker' }),
  ach('hire-guto', 'professor', 'Subiu pra Nuvem', '☁️', 'Contrate o Guto.', hired('guto'), { skin: 'guto-churrasqueiro' }),
  ach('hire-b1', 'professor', 'Backlog Organizado', '📋', 'Contrate a Bruna B1.', hired('b1'), { skin: 'b1-po' }),
  ach('hire-angelo', 'professor', 'A Coordenação Chegou', '🏛️', 'Contrate o Angelo.', hired('angelo'), {
    skin: 'angelo-terno',
    scenery: 'coordenacao',
  }),
  ach('hire-pablo', 'professor', 'Cérebro na Equipe', '🧠', 'Contrate o Pablo.', hired('pablo'), { skin: 'pablo-cientista' }),

  // Every discipline of a professor at level 25: rare skin
  ach('lvl25-edecio', 'professor', 'Sala Cheia de Joinhas', '⚽️', 'Deixe todas as disciplinas do Edécio no nível 25.', allLevel('edecio', 25), {
    skin: 'edecio-atleta',
  }),
  ach('lvl25-gladimir', 'professor', 'Banco Bem Indexado', '🛰️', 'Deixe todas as disciplinas do Gladimir no nível 25.', allLevel('gladimir', 25), {
    skin: 'gladimir-maker',
  }),
  ach('lvl25-b2', 'professor', 'Interface Aprovada', '📐', 'Deixe todas as disciplinas da Bruna B2 no nível 25.', allLevel('b2', 25), {
    skin: 'b2-wireframe',
  }),
  ach('lvl25-wagner', 'professor', 'Rede Blindada', '🕵️', 'Deixe todas as disciplinas do Wagner no nível 25.', allLevel('wagner', 25), {
    skin: 'wagner-agente',
  }),
  ach('lvl25-guto', 'professor', 'Nuvem Estável', '🥁', 'Deixe todas as disciplinas do Guto no nível 25.', allLevel('guto', 25), {
    skin: 'guto-pagodeiro',
  }),
  ach('lvl25-b1', 'professor', 'Layout Alinhado', '📏', 'Deixe todas as disciplinas da Bruna B1 no nível 25.', allLevel('b1', 25), {
    skin: 'b1-flexbox',
  }),
  ach('lvl25-angelo', 'professor', 'Pauta Cumprida', '🎼', 'Deixe todas as disciplinas do Angelo no nível 25.', allLevel('angelo', 25), {
    skin: 'angelo-maestro',
  }),
  ach('lvl25-pablo', 'professor', 'Complexidade Controlada', '♟️', 'Deixe todas as disciplinas do Pablo no nível 25.', allLevel('pablo', 25), {
    skin: 'pablo-enxadrista',
  }),

  // Every research of a professor: epic skin
  ach('research-edecio', 'professor', 'Currículo do Edécio', '💼', 'Compre todas as pesquisas do Edécio em uma mesma turma.', allResearch('edecio'), {
    skin: 'edecio-ceo',
  }),
  ach('research-gladimir', 'professor', 'Doutor em Hiperespaço', '🚀', 'Compre todas as pesquisas do Gladimir em uma mesma turma.', allResearch('gladimir'), {
    skin: 'gladimir-piloto',
  }),
  ach('research-b2', 'professor', 'Design System Completo', '🌙', 'Compre todas as pesquisas da Bruna B2 em uma mesma turma.', allResearch('b2'), {
    skin: 'b2-darkmode',
  }),
  ach('research-wagner', 'professor', 'Zero Vulnerabilidades', '🔥', 'Compre todas as pesquisas do Wagner em uma mesma turma.', allResearch('wagner'), {
    skin: 'wagner-firewall',
  }),
  ach('research-guto', 'professor', 'Infraestrutura Premiada', '🎧', 'Compre todas as pesquisas do Guto em uma mesma turma.', allResearch('guto'), {
    skin: 'guto-dj',
  }),
  ach('research-b1', 'professor', 'Backlog sob Controle', '🛰️', 'Compre todas as pesquisas da Bruna B1 em uma mesma turma.', allResearch('b1'), {
    skin: 'b1-lancamento',
  }),
  ach('research-angelo', 'professor', 'Coordenação Plena', '🎓', 'Compre todas as pesquisas do Angelo em uma mesma turma.', allResearch('angelo'), {
    skin: 'angelo-paraninfo',
  }),
  ach('research-pablo', 'professor', 'Teorema Concluído', '🪄', 'Compre todas as pesquisas do Pablo em uma mesma turma.', allResearch('pablo'), {
    skin: 'pablo-mago',
  }),

  // Every discipline of a professor at level 100: legendary skin
  ach('lvl100-edecio', 'professor', 'Muito, Muito Legal', '🥷🏻', 'Deixe todas as disciplinas do Edécio no nível 100.', allLevel('edecio', 100), {
    skin: 'edecio-samurai',
  }),
  ach('lvl100-gladimir', 'professor', 'Mestre do Banco', '🗡️', 'Deixe todas as disciplinas do Gladimir no nível 100.', allLevel('gladimir', 100), {
    skin: 'gladimir-mestre',
  }),
  ach('lvl100-b2', 'professor', 'Paleta Completa', '🌈', 'Deixe todas as disciplinas da Bruna B2 no nível 100.', allLevel('b2', 100), {
    skin: 'b2-paleta',
  }),
  ach('lvl100-wagner', 'professor', 'Cofre Inviolável', '🔐', 'Deixe todas as disciplinas do Wagner no nível 100.', allLevel('wagner', 100), {
    skin: 'wagner-cripto',
  }),
  ach('lvl100-guto', 'professor', 'Acima das Nuvens', '🌍', 'Deixe todas as disciplinas do Guto no nível 100.', allLevel('guto', 100), {
    skin: 'guto-astronauta',
  }),
  ach('lvl100-b1', 'professor', 'Reino do CSS', '👑', 'Deixe todas as disciplinas da Bruna B1 no nível 100.', allLevel('b1', 100), {
    skin: 'b1-rainha',
  }),
  ach('lvl100-angelo', 'professor', 'Herdeiro do Curso', '🏰', 'Deixe todas as disciplinas do Angelo no nível 100.', allLevel('angelo', 100), {
    skin: 'angelo-rei',
  }),
  ach('lvl100-pablo', 'professor', 'Cérebro do Universo', '🌌', 'Deixe todas as disciplinas do Pablo no nível 100.', allLevel('pablo', 100), {
    skin: 'pablo-galactico',
  }),

  // ------------------------------------------------------------------ events (7)
  ach('defend-10', 'events', 'Guarda do Campus', '⛓️', 'Defenda 10 invasões.', counter('eventsDefended', 10), { scenery: 'prisao' }),
  ach('defend-50', 'events', 'Caçador de Ameaças', '🚨', 'Defenda 50 invasões.', counter('eventsDefended', 50), {
    skin: 'edecio-prisioneiro',
  }),
  ach('defend-250', 'events', 'Gladiador da Rede', '🗡️', 'Defenda 250 invasões.', counter('eventsDefended', 250), {
    skin: 'edecio-gladiador',
  }),
  ach('streak-5', 'events', 'Cinco Seguidas', '🔒', 'Defenda 5 invasões seguidas, sem deixar nenhuma escapar.', counter('bestEventStreak', 5)),
  ach('streak-10', 'events', 'Torcida Organizada', '🏟️', 'Defenda 10 invasões seguidas.', counter('bestEventStreak', 10), {
    scenery: 'arena',
  }),
  ach('streak-25', 'events', 'Firewall Humano', '🧱', 'Defenda 25 invasões seguidas.', counter('bestEventStreak', 25)),
  ach('missed-10', 'events', 'Senha 123456 Aprovada', '🔑', 'Deixe 10 invasões escaparem. A segurança agradece a sinceridade.', counter('eventsMissed', 10)),

  // ------------------------------------------------------------------ sprints (6)
  ach('sprint-1', 'sprints', 'Primeiro Sprint', '🏁', 'Conclua 1 sprint.', counter('sprintsCompleted', 1)),
  ach('sprint-5', 'sprints', 'Time Entregando', '📦', 'Conclua 5 sprints.', counter('sprintsCompleted', 5)),
  ach('sprint-25', 'sprints', 'Ritmo de Equipe', '🔁', 'Conclua 25 sprints.', counter('sprintsCompleted', 25)),
  ach('sprint-50', 'sprints', 'Cinquenta Retrospectivas', '📊', 'Conclua 50 sprints.', counter('sprintsCompleted', 50)),
  ach('sprint-100', 'sprints', 'Cem Sprints', '💯', 'Conclua 100 sprints.', counter('sprintsCompleted', 100)),
  ach('sprint-fail-10', 'sprints', 'Prazo é uma Sugestão', '⏰', 'Deixe 10 sprints vencerem sem cumprir a meta.', counter('sprintsFailed', 10)),

  // ------------------------------------------------------------------ graduation (8)
  ach('grad-1', 'graduation', 'Primeira Formatura', '🎓', 'Faça a primeira Formatura.', counter('graduations', 1), {
    scenery: 'formatura',
  }),
  ach('grad-5', 'graduation', 'Cinco Turmas', '📜', 'Faça 5 Formaturas.', counter('graduations', 5)),
  ach('grad-10', 'graduation', 'Decano', '🏅', 'Faça 10 Formaturas.', counter('graduations', 10)),
  ach('grad-25', 'graduation', 'Patrono do Curso', '🏆', 'Faça 25 Formaturas.', counter('graduations', 25)),
  ach('diplomas-100', 'graduation', 'Parede de Diplomas', '🖼️', 'Ganhe 100 diplomas no total.', { kind: 'diplomasEarned', gte: 100 }),
  ach('diplomas-10000', 'graduation', 'Gráfica Sobrecarregada', '🖨️', 'Ganhe 10.000 diplomas no total.', { kind: 'diplomasEarned', gte: 10000 }),
  ach('tree-5', 'graduation', 'Raízes Fundas', '🌱', 'Tenha 5 nós da árvore de Formatura.', { kind: 'prestigeNodes', gte: 5 }),
  ach('tree-15', 'graduation', 'Árvore Frondosa', '🌳', 'Tenha 15 nós da árvore de Formatura.', { kind: 'prestigeNodes', gte: 15 }),

  // ------------------------------------------------------------------ collection (6)
  ach('skins-10', 'collection', 'Guarda-Roupa Colorido', '👕', 'Tenha 10 skins.', { kind: 'skinsOwned', gte: 10 }, { theme: 'pastel' }),
  ach('skins-25', 'collection', 'Provador Lotado', '🧥', 'Tenha 25 skins.', { kind: 'skinsOwned', gte: 25 }),
  ach('skins-all', 'collection', 'Álbum Completo', '📒', 'Tenha todas as 46 skins.', { kind: 'skinsOwned', gte: 46 }),
  ach('achievements-25', 'collection', 'Vitrine Cheia', '🏆', 'Conquiste 25 conquistas.', { kind: 'achievements', gte: 25 }),
  ach('achievements-50', 'collection', 'Parede de Troféus', '🥇', 'Conquiste 50 conquistas.', { kind: 'achievements', gte: 50 }),
  ach('achievements-75', 'collection', 'Quase Tudo', '🌟', 'Conquiste 75 conquistas.', { kind: 'achievements', gte: 75 }),

  // ------------------------------------------------------------------ secret (8)
  ach('secret-logo', 'secret', 'Curioso Demais', '🔎', 'Clique 10 vezes no logo do jogo.', { kind: 'secret', trigger: 'logo-clicks' }, undefined, true),
  ach('secret-konami', 'secret', 'Código Antigo', '🕹️', 'Digite o código Konami.', { kind: 'secret', trigger: 'konami' }, { theme: 'terminal' }, true),
  ach('secret-night-owl', 'secret', 'Coruja da Madrugada', '🦉', 'Jogue entre 3h e 5h da manhã.', { kind: 'secret', trigger: 'night-owl' }, undefined, true),
  ach('secret-swap', 'secret', 'Professor Rotativo', '🔄', 'Troque de professor 20 vezes em 1 minuto.', { kind: 'secret', trigger: 'swap-spree' }, undefined, true),
  ach('secret-idle', 'secret', 'Observador Paciente', '👀', 'Fique 1 minuto sem clicar com o jogo aberto.', { kind: 'secret', trigger: 'idle-watcher' }, undefined, true),
  ach('secret-joinha', 'secret', 'Muito Legal!', '👍', 'Digite "muito legal" no jogo.', { kind: 'secret', trigger: 'joinha' }, undefined, true),
  ach('secret-offline', 'secret', 'Bom Retorno', '🌙', 'Recolha o ganho offline 5 vezes.', counter('offlineCollections', 5), undefined, true),
  ach('secret-dedicacao', 'secret', 'Vida Acadêmica', '⌛', 'Jogue por 10 horas no total.', counter('playSeconds', 36000), undefined, true),
];
