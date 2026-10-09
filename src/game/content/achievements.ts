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
 * 129 achievements. Each gives +1% global production; some also grant a skin, scenery or theme.
 * Every non-default cosmetic is granted by exactly one achievement, and harder ones give rarer skins:
 * common = hire / early clicks, rare = discipline level 25, epic = all research, legendary = level 100
 * or a long-haul challenge; mythic (one per professor) is reserved for the hardest feat of each family
 * (a million clicks, a Domínio at the cap, 25 graduations, 50 defended invasions in a row...).
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
  ach('click-50k', 'click', 'Meio Caminho Andado', '🏃', 'Dê 50.000 cliques.', counter('clicks', 50000), { theme: 'vermelho' }),
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
  ach('session-1h', 'click', 'Mateada', '🧉', 'Jogue 1 hora seguida, de uma só vez. A cuia esfria, o joinha não.', { kind: 'session', gte: 3600 }, {
    skin: 'edecio-gauchao',
  }),
  ach('click-500k', 'click', 'Meio Milhão de Joinhas', '🌟', 'Dê 500.000 cliques. A mão já tem memória muscular própria.', counter('clicks', 500000), {
    skin: 'edecio-lenda',
  }),
  ach('click-1m', 'click', 'Um Milhão de Joinhas', '🤝', 'Dê 1.000.000 de cliques. Os dedos pedem arrego, o joinha não.', counter('clicks', 1000000), {
    skin: 'edecio-primordial',
  }),

  // ------------------------------------------------------------------ production (15)
  ach('coins-1e3', 'production', 'Troco de Cantina', '🪙', 'Ganhe 1.000 ADScoins no total.', { kind: 'lifetimeCoins', gte: '1e3' }, { scenery: 'cantina' }),
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
  ach('coins-1e21', 'production', 'Sextilhão no Bolso', '💰', 'Ganhe 1 sextilhão de ADScoins no total.', { kind: 'lifetimeCoins', gte: '1e21' }, { scenery: 'orla' }),
  ach('coins-1e24', 'production', 'Septilhão de Boas Notas', '🏦', 'Ganhe 1 septilhão de ADScoins no total.', { kind: 'lifetimeCoins', gte: '1e24' }, { scenery: 'espaco' }),
  ach('cps-10', 'production', 'Tá Rendendo', '📈', 'Produza 10 ADScoins por segundo.', { kind: 'coinsPerSecond', gte: '10' }),
  ach('cps-100', 'production', 'Rato de Laboratório', '🖥️', 'Produza 100 ADScoins por segundo.', { kind: 'coinsPerSecond', gte: '100' }, {
    scenery: 'laboratorio',
  }),
  ach('cps-1e4', 'production', 'Casa que Trabalha Sozinha', '🏠', 'Produza 10.000 ADScoins por segundo.', { kind: 'coinsPerSecond', gte: '1e4' }, {
    scenery: 'casa-automatica',
  }),
  ach('cps-1e7', 'production', 'Dez Milhões por Segundo', '⚡', 'Produza 10 milhões de ADScoins por segundo.', { kind: 'coinsPerSecond', gte: '1e7' }, { scenery: 'estudio' }),
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
  ach('abilities-tried', 'production', 'Primeira Rodada', '🎛️', 'Use todas as habilidades pelo menos uma vez. É a rodada de testes.', { kind: 'abilitiesTried' }, {
    skin: 'guto-paladino',
  }),
  ach('abilities-active', 'production', 'Tudo no Ar', '🌩️', 'Deixe todas as habilidades ativas ao mesmo tempo. Deploy em produção, numa sexta.', { kind: 'abilitiesActive' }, {
    skin: 'guto-capitao',
  }),
  ach('abilities-1000', 'production', 'Dia de Tempestade', '⛈️', 'Use 1.000 habilidades no total. Cada clique no botão é um raio.', counter('abilitiesUsed', 1000), {
    skin: 'guto-tempestade',
  }),
  ach('research-all', 'production', 'P = NP', '♾️', 'Compre todas as pesquisas do jogo em uma mesma turma. Provado por exaustão.', { kind: 'everyResearch' }, {
    skin: 'pablo-oraculo',
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
  ach('lvl50-angelo', 'professor', 'Bandeja Perfeita', '🎾', 'Deixe todas as disciplinas do Angelo no nível 50.', allLevel('angelo', 50), {
    skin: 'angelo-padel',
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

  // Whole-class feats: levels bought, aligned classes, Domínio
  ach('levels-run-500', 'professor', 'Índice Criado', '🗂️', 'Compre 500 níveis de aulas em uma mesma turma. Consulta rápida garantida.', {
    kind: 'runCounter',
    counter: 'levelsBought',
    gte: 500,
  }, { skin: 'gladimir-bibliotecario' }),
  ach('bulk-100', 'professor', 'Compra Coletiva', '🛒', 'Compre 100 níveis de uma vez só. Quem compra em lote economiza no frete.', counter('biggestPurchase', 100), {
    skin: 'b2-obra',
  }),
  ach('aligned-50', 'professor', 'Alinhada', '🧮', 'Deixe todas as aulas de um professor exatamente no mesmo nível, a partir do 50. Nenhum pixel fora do lugar.', {
    kind: 'alignedLevels',
    level: 50,
  }, { skin: 'b2-pixel' }),
  ach('mastery-gladimir', 'professor', 'Nada se Perde', '💾', 'Leve o Domínio do Gladimir ao máximo (40). Backup do backup do backup.', {
    kind: 'mastery',
    professor: 'gladimir',
    rank: 40,
  }, { skin: 'gladimir-arquivista' }),
  ach('mastery-gladimir-25', 'professor', 'Backup Semanal', '💽', 'Leve o Domínio do Gladimir ao rank 25. Metade do caminho até o backup eterno.', {
    kind: 'mastery',
    professor: 'gladimir',
    rank: 25,
  }, { skin: 'gladimir-guardiao' }),
  ach('legado-edecio', 'professor', 'Legado', '📜', 'Some 500 níveis nas aulas do Edécio. Quem começou tudo não sai de moda.', {
    kind: 'professorLevels',
    professor: 'edecio',
    gte: 500,
  }, { scenery: 'servidor-antigo' }),
  ach('mastery-all-10', 'professor', 'Corpo Docente', '🧑‍🏫', 'Deixe os 8 professores com Domínio 10 ou mais ao mesmo tempo.', { kind: 'mastery', rank: 10 }, { scenery: 'castelo' }),

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
    skin: 'wagner-detetive',
  }),
  ach('streak-25', 'events', 'Firewall Humano', '🧱', 'Defenda 25 invasões seguidas.', counter('bestEventStreak', 25), {
    skin: 'wagner-cavaleiro',
  }),
  ach('streak-50', 'events', 'Sentinela', '🛰️', 'Defenda 50 invasões seguidas. Nem um pacote passou.', counter('bestEventStreak', 50), {
    skin: 'wagner-sentinela',
  }),
  ach('streak-100', 'events', 'Zero Dia', '🏰', 'Defenda 100 invasões seguidas. Nenhuma vulnerabilidade foi explorada.', counter('bestEventStreak', 100)),
  ach('missed-10', 'events', 'Senha 123456 Aprovada', '🔑', 'Deixe 10 invasões escaparem. A segurança agradece a sinceridade.', counter('eventsMissed', 10), {
    skin: 'wagner-ferias',
  }),

  // ------------------------------------------------------------------ sprints (6)
  ach('sprint-1', 'sprints', 'Primeiro Sprint', '🏁', 'Conclua 1 sprint.', counter('sprintsCompleted', 1)),
  ach('sprint-5', 'sprints', 'Time Entregando', '📦', 'Conclua 5 sprints.', counter('sprintsCompleted', 5)),
  ach('sprint-25', 'sprints', 'Ritmo de Equipe', '🔁', 'Conclua 25 sprints.', counter('sprintsCompleted', 25), { skin: 'b1-scrum' }),
  ach('sprint-50', 'sprints', 'Cinquenta Retrospectivas', '📊', 'Conclua 50 sprints.', counter('sprintsCompleted', 50), { scenery: 'feira' }),
  ach('sprint-100', 'sprints', 'Cem Sprints', '💯', 'Conclua 100 sprints.', counter('sprintsCompleted', 100), { skin: 'b1-arquiteta' }),
  ach('sprint-fail-10', 'sprints', 'Prazo é uma Sugestão', '⏰', 'Deixe 10 sprints vencerem sem cumprir a meta.', counter('sprintsFailed', 10)),

  // ------------------------------------------------------------------ graduation (8)
  ach('grad-1', 'graduation', 'Primeira Formatura', '🎓', 'Faça a primeira Formatura.', counter('graduations', 1), {
    scenery: 'formatura',
  }),
  ach('grad-5', 'graduation', 'Cinco Turmas', '📜', 'Faça 5 Formaturas.', counter('graduations', 5), { scenery: 'quadra-de-padel' }),
  ach('grad-10', 'graduation', 'Decano', '🏅', 'Faça 10 Formaturas.', counter('graduations', 10), { skin: 'edecio-formando' }),
  ach('grad-25', 'graduation', 'Patrono do Curso', '🏆', 'Faça 25 Formaturas.', counter('graduations', 25), { skin: 'angelo-chanceler' }),
  ach('grad-day-6', 'graduation', 'Set Fechado', '📅', 'Faça 6 Formaturas no mesmo dia. Ganhou o set, fecha o jogo.', { kind: 'graduationsToday', gte: 6 }, {
    skin: 'angelo-capitao',
  }),
  ach('grad-fast', 'graduation', 'O(1)', '⚡', 'Forme uma turma em menos de 10 minutos de jogo. Tempo constante, ou quase.', {
    kind: 'lastRun',
    metric: 'seconds',
    lte: 600,
  }, { skin: 'pablo-garagem' }),
  ach('grad-blitz', 'graduation', 'O(0)', '🚀', 'Forme uma turma em menos de 3 minutos de jogo. Já chegou formado.', {
    kind: 'lastRun',
    metric: 'seconds',
    lte: 180,
  }, { skin: 'pablo-singularidade' }),
  ach('grad-no-mouse', 'graduation', 'Sem Mouse', '🐭', 'Forme uma turma sem clicar no professor nenhuma vez. Os cliques automáticos valem.', {
    kind: 'lastRun',
    metric: 'clicks',
    lte: 0,
  }, { skin: 'gladimir-drone' }),
  ach('grad-click-share', 'graduation', 'Só no Clique', '👆', 'Forme uma turma em que 70% das ADScoins vieram de cliques.', { kind: 'lastRunClickShare', gte: 0.7 }),
  ach('grad-lean', 'graduation', 'Turma Enxuta', '🎒', 'Forme uma turma com aulas compradas de no máximo 3 professores. Os outros só assinam a ata.', {
    kind: 'lastRun',
    metric: 'investedProfessors',
    lte: 3,
  }, { scenery: 'masmorra' }),
  ach('grad-perfect', 'graduation', 'Semestre Perfeito', '✅', 'Forme uma turma sem perder sprint nem deixar invasão escapar, com pelo menos um de cada concluído.', {
    kind: 'lastRunClean',
  }, { skin: 'b1-imperatriz' }),
  ach('honour-all', 'graduation', 'Volta Olímpica', '🏟️', 'Homenageie cada um dos 8 professores em uma Formatura.', { kind: 'honoured', gte: 8 }, { scenery: 'neve' }),
  ach('diplomas-100', 'graduation', 'Parede de Diplomas', '🖼️', 'Ganhe 100 diplomas no total.', { kind: 'diplomasEarned', gte: 100 }, { skin: 'angelo-reitor' }),
  ach('diplomas-10000', 'graduation', 'Gráfica Sobrecarregada', '🖨️', 'Ganhe 10.000 diplomas no total.', { kind: 'diplomasEarned', gte: 10000 }, { scenery: 'grafica' }),
  ach('tree-5', 'graduation', 'Raízes Fundas', '🌱', 'Tenha 5 nós da árvore de Formatura.', { kind: 'prestigeNodes', gte: 5 }, { theme: 'floresta' }),
  ach('maestrias-all', 'graduation', 'Oito Mestres', '🎓', 'Libere a Maestria dos 8 professores. Cada um com a sua especialidade e nenhum com tempo livre.', { kind: 'maestrias', unlocked: 8 }),
  ach('maestrias-max', 'graduation', 'Mestre dos Mestres', '🧙', 'Leve uma Maestria ao nível 5. O resto da turma que espere o próximo diploma.', { kind: 'maestrias', unlocked: 1, level: 5 }, { theme: 'ouro' }),
  ach('tree-15', 'graduation', 'Árvore Frondosa', '🌳', 'Tenha 15 nós da árvore de Formatura.', { kind: 'prestigeNodes', gte: 15 }, { scenery: 'jardim' }),

  // ------------------------------------------------------------------ collection (6)
  ach('skins-10', 'collection', 'Guarda-Roupa Colorido', '👕', 'Tenha 10 skins.', { kind: 'skinsOwned', gte: 10 }, { theme: 'pastel' }),
  ach('skins-25', 'collection', 'Provador Lotado', '🧥', 'Tenha 25 skins.', { kind: 'skinsOwned', gte: 25 }),
  ach('skins-all', 'collection', 'Álbum Completo', '📒', 'Tenha todas as 75 skins.', { kind: 'skinsOwned', gte: 75 }),
  ach('achievements-25', 'collection', 'Vitrine Cheia', '🏆', 'Conquiste 25 conquistas.', { kind: 'achievements', gte: 25 }),
  ach('achievements-50', 'collection', 'Parede de Troféus', '🥇', 'Conquiste 50 conquistas.', { kind: 'achievements', gte: 50 }),
  ach('achievements-75', 'collection', 'Quase Tudo', '🌟', 'Conquiste 75 conquistas.', { kind: 'achievements', gte: 75 }, { scenery: 'trofeus' }),
  ach('days-7', 'collection', 'Sequência de Sete', '🗓️', 'Jogue 7 dias seguidos. Frequência de 100%.', counter('bestDayStreak', 7), { scenery: 'por-do-sol' }),
  ach('rares-all', 'collection', 'Colecionador de Raras', '💠', 'Tenha todas as skins raras.', { kind: 'rarityOwned', rarity: 'rare' }),
  ach('epics-all', 'collection', 'Colecionador de Épicas', '🔮', 'Tenha todas as skins épicas. A coleção brilha mais que o prisma.', { kind: 'rarityOwned', rarity: 'epic' }, {
    skin: 'b2-prisma',
  }),
  ach('legendaries-all', 'collection', 'Colecionador de Lendárias', '🌠', 'Tenha todas as skins lendárias. Só falta o céu como limite.', { kind: 'rarityOwned', rarity: 'legendary' }, {
    scenery: 'galaxia',
  }),

  // ------------------------------------------------------------------ secret (6)
  ach('secret-logo', 'secret', 'Curioso Demais', '🔎', 'Clique 10 vezes no logo do jogo.', { kind: 'secret', trigger: 'logo-clicks' }, { theme: 'terminal' }, true),
  ach('secret-night-owl', 'secret', 'Coruja da Madrugada', '🦉', 'Jogue entre 3h e 5h da manhã.', { kind: 'secret', trigger: 'night-owl' }, { scenery: 'madrugada' }, true),
  ach('secret-swap', 'secret', 'Professor Rotativo', '🔄', 'Troque de professor 20 vezes em 1 minuto.', { kind: 'secret', trigger: 'swap-spree' }, undefined, true),
  ach('secret-idle', 'secret', 'Observador Paciente', '👀', 'Fique 1 minuto sem clicar com o jogo aberto.', { kind: 'secret', trigger: 'idle-watcher' }, { theme: 'roxo' }, true),
  ach('secret-offline', 'secret', 'Bom Retorno', '🌙', 'Recolha o ganho offline 5 vezes.', counter('offlineCollections', 5), { skin: 'gladimir-pescador' }, true),
  ach('secret-dedicacao', 'secret', 'Vida Acadêmica', '⌛', 'Jogue por 10 horas no total.', counter('playSeconds', 36000), { scenery: 'biblioteca' }, true),
  ach('secret-friday', 'secret', 'Deploy de Sexta', '🚀', 'Jogue numa sexta-feira às 17:59. Sexta ninguém faz deploy, mas todo mundo faz.', { kind: 'secret', trigger: 'friday-deploy' }, undefined, true),
  ach('secret-404', 'secret', 'Erro 404', '🧭', 'Tenha exatamente 404 ADScoins. Saldo não encontrado.', { kind: 'secret', trigger: 'error-404' }, undefined, true),
  ach('secret-wallpaper', 'secret', 'Papel de Parede', '🖼️', 'Fique 5 minutos com o painel lateral escondido, só admirando o cenário.', { kind: 'secret', trigger: 'wallpaper' }, undefined, true),
  ach('secret-fitting', 'secret', 'Provador', '🪞', 'Troque de skin 10 vezes em 1 minuto. Nada serviu de primeira.', { kind: 'secret', trigger: 'fitting-room' }, undefined, true),
  ach('secret-lettuce', 'secret', 'Mão de Alface', '🥬', 'Venda com prejuízo na Bolsa do Pablo. A planilha chorou.', { kind: 'secret', trigger: 'lettuce-hands' }, undefined, true),
  ach('secret-hands-off', 'secret', 'Deixa Comigo', '🙌', 'Dispare uma Super invasão e não derrote nenhum bug na mão. O firewall cuida.', { kind: 'secret', trigger: 'hands-off' }, undefined, true),
];
