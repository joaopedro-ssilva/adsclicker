# ADSClicker — design do jogo

Clicker + idle em pixel art. O jogador monta o corpo docente de um curso de ADS: começa com o Edécio em sala e contrata os outros 7 professores. Cada professor é dono de uma camada do jogo. Texto do jogo em pt-BR.

Herança do original (Edécio Clicker v1.3): a moeda (Edécoin no original, ADScoin no remaster), o "+N 👍" flutuante, a regra "nível 10 libera o próximo", os nomes dos upgrades (Café Quentinho ☕, Muito Legal 👍, Programação 💻, Academia Avenida 💪, Projetinho 🗿, Prainha 🏝️, Cria 🤬, Prisão ⛓️, Nether 🕳️, Full Dima 💎, Casa Automática 🏠, Atleta ⚽️, Cidade 🏙️, Ceo 💼, Exílio 🏜️, Gladiador 🗡️, Templo 🛕, Samurai 🥷🏻) e as skins/cenários com esses temas.

## 1. Moedas

- **ADScoins**: compra tudo dentro de uma turma. Símbolo `$`.
- **Diplomas**: prestígio. Ganhos na Formatura, gastos na árvore permanente. Cada diploma já ganho dá +1% de produção global para sempre, até um teto de +100% (100 diplomas).

## 2. Professores

| Ordem | id | Nome no jogo | Disciplina | Camada (features) | Cor |
| --- | --- | --- | --- | --- | --- |
| 1 | `edecio` | Edécio | API e Lógica de Programação | Clique: combo e crítico (`combo`) | vermelho `#e5484d` |
| 2 | `gladimir` | Gladimir | Banco de Dados e IoT | Idle: ganho offline e auto-clique (`offline`) | azul `#3b82f6` |
| 3 | `b2` | Bruna B2 | Design UX | Conforto: compra em lote, descontos, temas da HUD (`bulkBuy`, `hudThemes`) | rosa `#ec4899` |
| 4 | `wagner` | Wagner | Cibersegurança e Redes | Eventos: invasões na tela (`events`) | verde `#22c55e` |
| 5 | `guto` | Guto | Arquitetura em Nuvem | Escala: habilidades com recarga (`abilities`) | ciano `#06b6d4` |
| 6 | `b1` | Bruna B1 | Produtos e CSS/UX | Missões: sprints (`sprints`) | roxo `#a855f7` |
| 7 | `angelo` | Angelo | Coordenação e POO | Sinergia e Formatura (`synergy`, `graduation`) | âmbar `#f59e0b` |
| 8 | `pablo` | Pablo | Algoritmos e Estrutura de Dados | Otimização: reduz crescimento de custo (`complexity`). Exige 1 formatura | índigo `#6366f1` |

Edécio começa contratado. Os outros são contratados com ADScoins, em ordem (cada um exige o anterior contratado). Pablo exige também `graduations >= 1`.

O professor selecionado aparece no palco e é o alvo do clique; pode ser trocado a qualquer momento entre os contratados. A troca é só visual: o bônus de "pôr em sala" foi removido por confundir (`activeBonus` vale 1).

### Personalidades (para falas e nomes; humor leve, nunca sobre a pessoa)

- **Edécio**: o mais sério, mas fala tudo sorrindo. Bordões: "Muito legal!", joinha 👍, "Parabéns!". Humor involuntário.
- **Gladimir**: o mais piadista. Muito nerd, fã de Star Wars; trocadilhos de banco de dados com referências galácticas ("Que o JOIN esteja com você"). Pode ser bem engraçado.
- **Guto**: o da resenha. Gosta de curtir e fazer piada. Sem referência direta a bebida.
- **Angelo**: formal, coordenador, mas solta piada seca no meio da formalidade.
- **Pablo**: inteligente e fera em código, sem arrogância. Fala de algoritmos, tecnologias legais e inteligência artificial, sempre puxando o aluno para cima.
- **Wagner, Bruna B1, Bruna B2**: ainda sem informação. Tom neutro e simpático, humor só da disciplina (senha fraca, pixel fora do lugar, backlog infinito).

## 3. Upgrades

Três tipos, sempre ligados a um professor.

- **Disciplinas** (24 = 3 por professor): têm nível, geram ADScoins/s. A disciplina de tier 0 abre ao contratar; a de tier n abre quando a de tier n-1 chega ao nível 10.
- **Upgrades de clique** (6 no total, espalhados): têm nível, somam valor ao clique.
- **Pesquisas** (~40, 4 a 6 por professor): compra única. Efeitos por `Effect`. É aqui que a mecânica de cada professor melhora.

Fórmulas (todas as constantes em `BalanceConfig`):

- Custo do nível seguinte: `baseCost × growth^level × costMult`, com `growth = max(minCostGrowth, costGrowth + stat(costGrowth))`. Base `costGrowth = 1.15`, `minCostGrowth = 1.07`.
- Marcos: nos níveis 10, 25, 50, 100, 200 e depois a cada 100, a saída daquele upgrade multiplica. Até o 100 é ×2; os marcos 200 e 300 valem ×3 e o 400 vale ×4 (`balance.milestoneMults`), para uma turma velha em nível alto alcançar uma nova em nível baixo. Depois do 400 volta a ×2 a cada 100.
- Produção de uma disciplina por segundo:
  `baseProduction × level × 2^marcos × disc × prof × idlePower × globalPower × (1 + synergy × outrosProfessoresContratados)`
- `globalPower` inclui: `1 + 0.01 × conquistas` e `1 + min(1, 0.01 × diplomasEarned)` (`bonusPerDiploma` e `maxBonus`), além dos efeitos.
- Valor do clique:
  `(baseClick + Σ upgradesDeClique(baseClick × level × 2^marcos)) × clickPower × globalPower × comboMult × (crítico ? critMult : 1) + clickFromIdle × coinsPerSecond`
- Compra em lote ×1, ×10, máx. (feature `bulkBuy`; antes dela só ×1).

Escala sugerida das 24 disciplinas na ordem de contratação (o simulador ajusta): custo base cresce ~×9 e produção base ~×7,8 a cada tier global, partindo de custo 60 e produção 0,2/s. Custos de contratação ficam entre o último tier do professor anterior e o primeiro do novo. Cada upgrade de clique soma por nível ~4% da produção do primeiro tier do seu professor (o clique é o motor dos primeiros minutos; depois o que paga é a produção e o `clickFromIdle`). O preço das pesquisas segue a renda do jogador quando elas liberam (de 30 s a 5 min de renda, conforme o ganho).

## 4. Camadas

### Combo e crítico (Edécio)
- Cada clique dentro de `windowMs` (1500 ms) do anterior soma 1 passo de combo, até `comboMax` (base 20). `comboMult = 1 + steps × comboStep` (base 0,05 → ×2 no máximo).
- Sem clicar, o combo cai `decayPerSecond` passos por segundo depois da janela.
- Crítico "Muito Legal 👍": chance base 3%, multiplicador base ×7.

### Idle e offline (Gladimir)
- Ao voltar depois de `minAwayMs` (60 s) fora, o jogo paga `coinsPerSecond × tempo × offlineRate`, com o tempo limitado a `offlineHours`. Base: 2 h a 50%. Pesquisas levam a 12 h e 100%. Sem o Gladimir, nada é pago.
- Sensores IoT: stat `autoClicks` (cliques automáticos por segundo, sem combo nem crítico).

### Conforto e temas (Bruna B2)
- Libera compra em lote. Pesquisas dão `costMult` (descontos) e aumentam duração de buffs e janelas de evento.
- Temas da HUD: só cores (fundo, superfícies, bordas, texto). 9 temas: padrão escuro, claro, alto contraste, terminal verde, pastel, Floresta (Raízes Fundas), Roxo (Observador Paciente), Vermelho (Meio Caminho Andado, 50 mil cliques) e Ouro (Mestre dos Mestres). Liberados por conquistas.

### Invasões (Wagner)
- A cada 75 a 150 s (× `eventInterval`) surge uma ameaça numa posição aleatória do palco. Ela some depois de `windowMs` (× `eventWindow`). O jogador precisa clicar `clicksRequired` vezes nela.
- Defendida: recompensa (`Reward`) × `eventReward` e a sequência (`eventStreak`) sobe. Perdida: a sequência zera. Sem punição além disso.
- 6 tipos, por exemplo: Phishing 🎣, DDoS 🌊, Ransomware 🔒, SQL Injection 💉, Senha 123456 🔑, Engenharia Social 🎭. Recompensas: moedas equivalentes a 15–150 s de produção, ou buffs curtos (produção ×3 por 30 s, clique ×10 por 15 s). Defendendo 80% delas, rendem cerca de +25% de renda no começo; as pesquisas e a árvore de eventos podem dobrar isso.

### Habilidades (Guto)
- Botões com recarga que aplicam um buff. "Auto Scaling ☁️": toda a produção ×5 por 30 s, recarga 10 min. Outras 2 ou 3 habilidades são liberadas por pesquisas de outros professores (ex.: Edécio "Aula Show": clique ×10 por 15 s; Pablo "Big O": custos ×0,5 por 20 s).

### Sprints (Bruna B1)
- O jogo oferece 3 sprints; o jogador aceita 1. Cada sprint tem meta, prazo (60–240 s) e recompensa (coins de 5 a 125 s de produção, ou produção ×3 por 30 s). Concluído ou falho, novas ofertas aparecem após 150 s.
- Metas: N cliques, N críticos, chegar a combo N, comprar N níveis, defender N invasões, ganhar o equivalente a N segundos de produção. ~12 sprints no conteúdo; os que dependem de outra camada têm `requires`.

### Sinergia e Formatura (Angelo)
- Sinergia: cada disciplina ganha `synergy` (base 5%) por cada outro professor contratado. Pesquisas aumentam.
- **Formatura** (prestígio): disponível com o Angelo contratado. `diplomas = floor((runCoins / base)^exponent × diplomaGain)`, com `base = 2e19` e `exponent = 0.5`: a primeira formatura de um jogador ativo (cerca de 2 h 45) rende uns 10 diplomas, e cada formatura seguinte exige 4× mais ADScoins da corrida para dobrar os diplomas dela. Só pode formar se ganhar pelo menos 1. **Limite por corrida**: uma formatura paga no máximo `10 × 1,3^formaturas já feitas` diplomas (10, 13, 16, 21, 27...); ADScoins além disso não rendem diploma, então esperar não compensa. A aba Formatura mostra "n/limite diplomas desta turma". O bônus de produção dos diplomas (+1% cada) para em +100%, e a aba mostra esse valor, não o produto bruto. Constantes em `balance.graduation.cap`; as turmas do simulador (ativo) vão de 2 h 26 na primeira a ~20 min na 12ª.
- Zera: moedas, `runCoins`, níveis, pesquisas, contratações (menos Edécio e os mantidos por nós de prestígio), buffs, invasão, sprint, combo, recargas.
- Mantém: diplomas, árvore, conquistas, skins, cenários, temas, contadores, configurações.
- **Árvore de prestígio**: ~20 nós em 4 ramos — `core` (tronco: produção global, manter professores, ganho de diplomas), `click`, `idle`, `events`. Nós têm nível máximo e custo crescente (1 a 30 diplomas no primeiro nível, dobrando a cada nível; a árvore inteira custa ~1.900 diplomas, algo como 12 formaturas).

### Domínio (todos os professores)
- O Domínio de um professor vem da soma dos níveis das 3 aulas dele na turma atual: 1 rank a cada 25 níveis, até 40 ranks (1.000 níveis, perto de 333 por aula). Zera na Formatura, junto com os níveis.
- Cada rank dá um bônus na mecânica que o professor já possui, e o bônus vale para o jogo inteiro, não só para as aulas dele. Valores por rank (no teto de 40):

| Professor | Por rank | No teto |
| --- | --- | --- |
| Edécio | cada clique rende a mais +0,15% do que a turma inteira produz por segundo | +6% |
| Gladimir | +0,15 h no teto offline e +0,5 ponto na taxa | +6 h e +20 pontos |
| Bruna B2 | custos ×0,99 | −33% em tudo |
| Wagner | recompensa de invasão +2,5% | ×2 |
| Guto | buffs +1% mais longos, recargas ×0,99 | +40% e −33% |
| Bruna B1 | recompensa de sprint +2,5% | ×2 |
| Angelo | +0,5% de diplomas por formatura | +20% |
| Pablo | produção global ×1,0075 (composto) | ×1,35 |

- Na aba Aulas, o cabeçalho do professor selecionado mostra o rank, uma barra fina até o próximo e uma linha com o bônus atual.

### Professor homenageado
- Ao formar a turma, o jogador pode escolher um professor contratado para homenagear na turma seguinte (opcional, nenhum por padrão). A escolha vale por uma turma e só conta enquanto o professor está contratado. Fica marcado com uma estrela no elenco.
- Efeitos: Edécio, o limite do combo dobra; Gladimir, o offline paga 100% e conta 4 h a mais; B2, o desconto do Domínio vale em dobro; Wagner, invasões duas vezes mais seguido e pagando 50% a mais; Guto, recargas pela metade; B1, sprints pagam o dobro; Angelo, +25% de diplomas na formatura dessa turma; Pablo, o bônus de produção do Domínio vale uma vez e meia.
- O jogo guarda quais professores já foram homenageados (conquista Volta Olímpica).

### Maestrias (depois da primeira Formatura)
- Uma mecânica própria por professor. Cada formatura dá **uma vaga** (quem já tinha formaturas ganha as vagas delas); o jogador escolhe, na aba Formatura, qual professor recebe (com confirmação: não troca). O nível 1 vem com a vaga; os níveis 2 a 5 custam 50 / 150 / 350 / 750 diplomas (1.300 por Maestria, ~10.400 as oito, bem mais que a árvore de 1.890). Valem para sempre, mesmo com o professor ainda não contratado na turma.
- Dentro da turma zeram só os contadores (progresso do Joinha, cargas do Rollforward, enxame em curso); níveis e a carga da Super invasão ficam.
- Primeira onda:
  - **Edécio, Joinha de Ouro**: a cada 100 / 90 / 80 / 70 / 60 cliques manuais, o próximo clique é de ouro e vale 6 / 9 / 12 / 16 / 20 s da produção da turma (sem buffs temporários). Pode ser crítico a partir do nível 3. No nível 5, segurar o mouse na tela clica 10 vezes por segundo (cada repetição é um clique normal, passa pelo limite de cliques).
  - **Gladimir, Rollforward**: 3.000 cliques manuais enchem uma carga; guarda 1 / 1 / 2 / 2 / 3. Gastar uma avança o jogo 15 / 25 / 35 / 50 / 70 s: as ADScoins do período (produção sem buffs) chegam de uma vez, e andam juntos as recargas das habilidades, a próxima oferta de sprint, a próxima invasão e a carga da Super invasão. Sprint em curso, invasão na tela e buffs ativos não mudam, e as moedas do salto não contam como progresso de sprint de produção. (A ideia do briefing, 5 a 60 min por salto, reduzia a 2ª corrida do jogador ativo à metade só no nível 1.)
  - **Wagner, Super invasão**: carrega com tempo real, uma vez a cada 60 / 52 / 45 / 38 / 30 min (uma carga guardada). Ao disparar, por 45 s, 24 bugs (sprites do Hackathon) aparecem pelo palco, cada um com 2 a 5 de vida e 6,5 s para escapar, e o chefe "Deploy de sexta" (24 de vida) chega aos 33 s. Prêmio: 12 s de produção por bug e 120 s pelo chefe, ×1,5 se limpar tudo, ×1 / 1,25 / 1,5 / 1,8 / 2,2 por nível, ×bônus de recompensa de invasão do Wagner. Do nível 2 em diante o firewall derruba um bug sozinho a cada 3 / 2 / 1,3 / 0,8 s (o chefe, na metade do ritmo). A invasão que estiver na tela espera o enxame; nenhuma nova aparece durante ele.
- Segunda onda (a regra do dono: "você só paga e não precisa se preocupar", e quem quiser profundidade encontra). Todos os números ficam em `content/maestrias.ts`:
  - **Bruna B2, Design System**: cada nível de aula comprado **à mão** (até 10 por compra, para compras em lote) tem 6 / 9 / 12 / 15 / 18% de chance de dar 1 nível grátis em 1 / 1 / 2 / 2 / 3 aulas, só nas que estão abertas e cujo próximo nível custa menos do que o nível que acabou de ser pago (só desce: uma aula cara do Pablo levanta as baratas do Edécio, nunca o contrário). Níveis grátis não contam como níveis comprados, nem para a turma, nem para sprints de comprar (mesma regra dos monitores), e o Monitor de Compras não dispara a Maestria.
  - **Guto, Festa de lançamento**: botão com recarga de 40 / 36 / 32 / 28 / 25 min (tempo real; o Rollforward adianta; sobrevive à formatura). Dura 40 / 45 / 50 / 55 / 60 s: produção e cliques ×1,25 / 1,35 / 1,5 / 1,65 / 1,8, habilidades e invasões 2 / 2,5 / 3 / 4 / 5× mais rápidas, e a primeira invasão da festa chega em 5 s. Ao começar, **toda habilidade aberta dispara de uma vez**, mesmo em recarga. As habilidades disparadas pela festa não contam como usadas à mão (contador, "já usou") e seus buffs têm a Maestria como origem, então "Tudo no Ar" continua exigindo cliques do jogador. A festa é um buff comum (`buff-festa-N`): acaba na formatura e no offline. No palco: luzes, moldura, faixa com o tempo, confete e som (parado com "reduzir movimento").
  - **Bruna B1, Releases**: a cada 5 / 5 / 4 / 4 / 3 sprints concluídas na turma sai uma versão (v1.0, v2.0...), +3 / 3,5 / 4 / 4,5 / 5% de produção cada, **no máximo 10 por turma** (o limite nunca cresce; o teto é +50%). As versões não são salvas: saem de `run.sprintsCompleted`, então zeram na formatura sozinhas. Aparece na etiqueta pequena sob o cartão de sprint.
  - **Angelo, Horas complementares**: o que o jogador faz na turma conta horas: clique 0,005 h, invasão defendida 0,5, sprint concluída 0,75, habilidade usada 0,5, nível comprado 0,02. A barra tem 2 / 3 / 4 / 5 / 6 faixas de 10 h; nenhuma atividade conta mais que 30% da barra inteira. Cada faixa cheia vira **1 diploma na formatura, fora do limite da turma** (até 6). Zera ao formar. Só conta o que o jogador faz (monitores, níveis grátis e a festa não somam).
  - **Pablo, Bolsa de tokens**: quatro ativos de preço relativo (índice em torno de 1) que andam a cada 10 s de jogo, movidos pelo rng injetado (3 sorteios por ativo por passo, então a mesma semente dá o mesmo mercado): **GPU** (calma, faixa 0,8 a 1,25, nível 1), **Dados** (cíclico, ondas de 15 min, 0,6 a 1,6, nível 2), **Modelo** (nervoso, saltos, 0,45 a 2, nível 3), **Startup** (selvagem, 0,25 a 3, nível 4); mais o **Fundo**, que só sobe 0,2 a 0,4% por minuto. Compra e venda com ADScoins. Segurança: (1) o total investido é no máximo 2 / 4 / 6 / 10 / 15 min da produção da turma; (2) o lucro é pago por um balde de "liquidez" (em segundos de produção) que comporta esse mesmo limite e enche esse tanto por hora; vendas além do balde devolvem o principal e cortam o lucro, e o painel mostra a liquidez. O principal nunca é perdido por isso. Só o lucro entra nas ADScoins da turma (e nos diplomas); o principal já tinha sido contado. **Na formatura tudo é vendido ao preço do momento** (o lucro conta para a turma): carregar ADScoins de uma turma de produção alta para uma nova turma quebraria a economia. Os preços e o histórico continuam. Até 1 hora de passos é recuperada depois de um tempo longe; o resto é pulado.
  - Conquistas: Oito Mestres (as 8 Maestrias liberadas) e Mestre dos Mestres (uma no nível 5), sem recompensa.
- O servidor limita cada recompensa pelo nível da Maestria que o save mostra (veja `plausibility.ts` e `maestriaBounds.ts`), e confere vagas ≤ formaturas e diplomas gastos ≤ diplomas ganhos. Festa: uma por recarga (e uma já cheia), com o reforço, as habilidades e as invasões que ela traz. Bolsa: um balde cheio mais o que enche na janela. Horas: o teto de diplomas da formatura ganha mais uma faixa por Maestria de Angelo. Releases e Design System aparecem na própria produção do save, que já é o piso do teto.

### Limite de cliques
- O motor aceita no máximo 15 cliques manuais por segundo (janela móvel de 1 s, `balance.clickLimit`). O que passar é descartado em silêncio: sem moedas, combo, contadores, progresso do Joinha nem carga do Rollforward. O servidor usa o mesmo número. Cliques automáticos da árvore não passam por esse limite.

### Monitores (depois da primeira Formatura)
- Quatro alunos que assumem uma tarefa chata, contratados com diplomas na aba Formatura. Cada um tem 4 níveis (o primeiro contrata, os outros deixam o monitor mais rápido ou melhor), uma chave liga/desliga (o estado é salvo) e fica com o jogador entre as Formaturas, como a árvore. Rodam no tick do engine, nunca por clique, e não contam como o jogador agindo (a sessão de "1 minuto sem clicar" continua correndo).
- **Compras** 🛒: a cada 20 / 10 / 5 / 2,5 s compra 1 nível da aula que mais rende por ADScoin (ganho de produção do próximo nível ÷ custo). Só compra aulas de professores que o jogador já começou à mão (algum nível em qualquer aula dele) e nunca upgrades de clique nem contratações. Configuração: gasta no máximo 10 / 25 / 50 / 100% das ADScoins em mãos numa compra (padrão 50%), que é a reserva para o que o jogador está juntando.
- **Pesquisa** 🔬: a cada 30 / 15 / 8 / 4 s compra a pesquisa aberta mais barata, com o mesmo limite de gasto (padrão 50%). Roda antes do Compras, para este não deixar a pesquisa sem moedas.
- **Segurança** 🛡️: se a invasão ficar 5 / 4 / 3 / 2 s na tela, o monitor a defende e leva 35 / 50 / 65 / 80% do prêmio (moedas ou duração do buff; nunca encurta um buff que já está rodando mais longo). O jogador pode clicar antes e ganhar tudo.
- **Sprints** 📋: 30 / 15 / 6 / 2 s depois de as ofertas aparecerem, aceita uma. Preferência: a primeira, a que mais paga (moedas em segundos de produção; buff vale 2× a duração) ou só as de clique (cliques, críticos, combo, produção; pula comprar e defender, e se não houver nenhuma deixa a escolha com o jogador). Cumprir a meta continua sendo do jogador.
- **Preço em diplomas** (por nível): Compras 5 / 25 / 100 / 400, Segurança 8 / 35 / 140 / 500, Sprints 12 / 45 / 170 / 600, Pesquisa 10 / 40 / 150 / 550. O primeiro cabe na primeira ou segunda Formatura (limite de `10 × 1,3^formaturas` diplomas por corrida) e os quatro no máximo somam ~2.800, mais que a árvore inteira.
- **Regra das conquistas de jogar na mão**: o que um monitor faz é invisível para contadores, estatísticas da turma e sequência de defesas, e ele nunca soma nem tira. Compras não entra em níveis comprados (Índice Criado, Compra Coletiva, sprints de comprar) nem escolhe professor novo (Turma Enxuta) nem upgrade de clique (Só no Clique só piora com ele ligado, e a chave existe para isso); Segurança não conta como invasão defendida nem perdida e não mexe na sequência (Cinco Seguidas, Firewall Humano, Zero Dia, Semestre Perfeito, sprints de defender); Sprints: sprint aceita por ele que vence não conta como perdida (Prazo é uma Sugestão, Semestre Perfeito), e a que o jogador cumpre conta como concluída; Pesquisa não soma em pesquisas compradas; nenhum monitor clica (Sem Mouse, Só no Clique).
- Nada disso cria moedas: o servidor não muda a verificação de plausibilidade (há teste jogando com todos no nível máximo).

### Complexidade (Pablo)
- Pesquisas caras que reduzem `costGrowth` em 0,01 cada (até 1,10) e dão multiplicadores grandes. É o conteúdo de fim de jogo.

## 5. Conquistas

~129. Cada conquista dá +1% de produção global. Algumas dão skin, cenário ou tema.

| Família | Quantas | Exemplos |
| --- | --- | --- |
| `click` | ~14 | 100 / 1k / 10k / 100k cliques; 100 críticos; combo máximo |
| `production` | ~16 | marcos de ADScoins totais e de ADScoins/s |
| `professor` | ~24 | contratar cada um; todas as disciplinas de X no nível 25 / 50 / 100; todas as pesquisas de X |
| `events` | ~8 | defender 10 / 50 / 250; sequência de 10 / 25 |
| `sprints` | ~6 | concluir 5 / 25 / 100 sprints |
| `graduation` | ~15 | 1 / 5 / 10 / 25 formaturas; diplomas ganhos; nós da árvore; formaturas "de desafio" (sem clicar, em 10 min, turma enxuta, 70% das ADScoins por cliques, sem sprint falho nem invasão perdida, 6 no mesmo dia); homenagear os 8 |
| `collection` | ~8 | ter N skins; N conquistas; 7 dias seguidos; todas as skins raras |
| `secret` | 12 | descritas como "???" até acontecer |

Gatilhos secretos que a UI dispara com `triggerSecret(id)`: `logo-clicks` (clicar 10× no logo), `konami` (código Konami), `night-owl` (jogar entre 3h e 5h), `swap-spree` (trocar de professor 20× em 1 minuto), `idle-watcher` (1 minuto sem clicar com o jogo aberto), `joinha` (digitar "muito legal"), `friday-deploy` (jogar numa sexta às 17:59), `error-404` (saldo exato de 404 ADScoins inteiras), `wallpaper` (5 minutos com o painel lateral escondido), `fitting-room` (10 trocas de skin em 1 minuto), `lettuce-hands` (vender com prejuízo na Bolsa) e `hands-off` (disparar a Super invasão sem derrotar nenhum bug na mão). Os outros secretos usam condições normais.

Conquistas novas que olham a turma inteira (Sem Mouse, O(1), Turma Enxuta, Só no Clique, Semestre Perfeito) são julgadas no instante da Formatura, sobre os números da turma que acabou (`state.run`, guardado em `lastRun`). "Turma Enxuta" conta professores com níveis comprados (o Angelo exige os 6 anteriores contratados, então "contratar poucos" seria impossível). "Só no Clique" pede 70% das ADScoins da turma vindas de cliques, manuais ou automáticos. "Sem Mouse" só é possível com cliques automáticos, que não contam como cliques. "Mateada" conta tempo de sessão apenas enquanto o jogador age (deixar a aba aberta não vale). "Set Fechado" e "Sequência de Sete" usam o dia do relógio local do jogador.

Raridades de skin: comum, rara, épica, lendária e **mítica**, a mais alta. Há uma mítica por professor, sempre a recompensa da maior façanha de cada linha (Um Milhão de Joinhas, Domínio no máximo do Gladimir, todas as épicas, 50 invasões seguidas, 1.000 habilidades, Semestre Perfeito, 25 Formaturas, Formatura em menos de 3 minutos). No palco, uma skin mítica ganha brilho rosa e faíscas de pixel (desligados com "reduzir movimento"); no Álbum, moldura dupla própria.

Toda skin não padrão, todo cenário não padrão e todo tema não padrão é recompensa de exatamente uma conquista.

## 6. Skins e cenários (lista fechada: os ids valem para conteúdo e arte)

Pixel art caricato: corpo pequeno, cabeça grande. **Corpo e cabeça são camadas separadas.** A skin é o corpo (sem cabeça, termina num toco de pescoço); a cabeça pertence ao professor (`heads/<professorId>`). Uma skin com chapéu ou capacete tem a própria cabeça, o professor desenhado já usando o acessório (`heads/<skinId>`); enquanto essa arte não existe, vale a cabeça normal do professor.

Arquivos em `public/assets/`: `skins/<skinId>.png`, `heads/<professorId>.png`, `heads/<skinId>.png` (cabeça com acessório), `sceneries/<sceneryId>.png`. Skin id = `<professor>-<slug>`.

### Skins (75)

| Professor | id | Nome | Raridade | Roupa | Chapéu |
| --- | --- | --- | --- | --- | --- |
| edecio | `edecio-default` | Polo Vermelha | common (padrão) | polo vermelha e jeans | |
| edecio | `edecio-cafe` | Café Quentinho | common | avental de barista, caneca fumegante na mão | |
| edecio | `edecio-programador` | Programador | common | moletom preto com capuz, notebook debaixo do braço | |
| edecio | `edecio-chad` | Chad | rare | regata, braços musculosos, halter | |
| edecio | `edecio-cria` | Cria | rare | camisa de time, corrente dourada, bermuda, chinelo | boné aba reta |
| edecio | `edecio-prisioneiro` | Prisioneiro | rare | uniforme laranja de presidiário, algema solta | |
| edecio | `edecio-atleta` | Atleta | rare | uniforme de futebol, bola no pé | |
| edecio | `edecio-full-dima` | Full Dima | epic | armadura de blocos azul-diamante, espada de blocos | capacete de diamante |
| edecio | `edecio-ceo` | CEO | epic | terno escuro, gravata vermelha, maleta | |
| edecio | `edecio-gladiador` | Gladiador | epic | armadura romana, capa vermelha, gládio | elmo com crista |
| edecio | `edecio-samurai` | Samurai | legendary | armadura samurai azul-petróleo, katana | kabuto com chifres |
| edecio | `edecio-gauchao` | Gauchão | rare | bombacha, lenço e cuia de chimarrão | chapéu |
| edecio | `edecio-formando` | Formando de 1900 | epic | terno antigo e bengala | cartola |
| edecio | `edecio-lenda` | Lenda do Joinha | legendary | traje dourado e mão gigante de joinha |  |
| edecio | `edecio-primordial` | O Joinha Primordial | mythic | túnica celestial branca e dourada, manopla de ouro | auréola |
| gladimir | `gladimir-default` | Xadrez de Sempre | common (padrão) | camisa xadrez, calça cáqui, crachá | |
| gladimir | `gladimir-dba` | DBA de Plantão | common | colete, cabo de rede no ombro, caneca "SELECT *" | |
| gladimir | `gladimir-maker` | Maker IoT | rare | jaleco com sensores e LEDs, protoboard na mão | óculos de proteção |
| gladimir | `gladimir-piloto` | Piloto Rebelde | epic | macacão laranja de piloto espacial, colete branco | capacete de piloto |
| gladimir | `gladimir-mestre` | Mestre da Galáxia | legendary | túnica bege de cavaleiro espacial, sabre de luz azul | capuz |
| gladimir | `gladimir-pescador` | Pescador de Dados | common | colete de pesca, vara e balde | chapéu de pescador |
| gladimir | `gladimir-bibliotecario` | Bibliotecário | rare | cardigã e pilha de livros |  |
| gladimir | `gladimir-guardiao` | Guardião do Backup | epic | armadura e escudo em forma de disquete | elmo |
| gladimir | `gladimir-drone` | Piloto Automático | epic | camisa cinza, controle e drone |  |
| gladimir | `gladimir-arquivista` | Arquivista Eterno | mythic | manto azul com runas de dados e tomo luminoso | capuz de luz |
| b2 | `b2-default` | Blazer Rosa | common (padrão) | blazer rosa, camiseta branca, calça preta | |
| b2 | `b2-postit` | Mural de Post-its | common | roupa coberta de post-its coloridos, caneta na mão | |
| b2 | `b2-wireframe` | Wireframe | rare | roupa cinza com caixas e X de wireframe | |
| b2 | `b2-darkmode` | Dark Mode | epic | toda de preto com detalhes neon roxos | |
| b2 | `b2-paleta` | Paleta Viva | legendary | vestido em degradê arco-íris, pincel gigante | |
| b2 | `b2-obra` | Designer de Capacete | common | macacão e planta na mão | capacete de obra |
| b2 | `b2-pixel` | Pixel Perfeita | epic | roupa de quadrados e régua gigante |  |
| b2 | `b2-prisma` | Musa do Prisma | mythic | vestido de cristal que quebra a luz | tiara de prisma |
| wagner | `wagner-default` | All Black | common (padrão) | camiseta preta, calça cargo, crachá | |
| wagner | `wagner-hacker` | Capuz Verde | common | moletom com capuz e código verde, notebook | |
| wagner | `wagner-agente` | Agente Secreto | rare | terno preto, gravata fina, fone espiral | óculos escuros |
| wagner | `wagner-firewall` | Firewall | epic | armadura de tijolos com chamas laranja | |
| wagner | `wagner-cripto` | Cavaleiro da Criptografia | legendary | armadura prateada com cadeado no peito, escudo com chave | elmo |
| wagner | `wagner-detetive` | Detetive | rare | sobretudo e lupa | chapéu |
| wagner | `wagner-ferias` | Wagner de Férias | rare | camisa florida, boia de patinho, coco gelado | chapéu de palha e óculos escuros |
| wagner | `wagner-cavaleiro` | Cavaleiro do Cadeado | epic | armadura negra, espada em forma de chave | elmo aberto |
| wagner | `wagner-sentinela` | Sentinela Zero | mythic | armadura negra de contornos vermelhos, lança de energia | elmo fechado |
| guto | `guto-default` | Camisa Florida | common (padrão) | camisa havaiana, bermuda, chinelo | |
| guto | `guto-churrasqueiro` | Mestre do Churrasco | common | avental, espeto na mão, pano no ombro | |
| guto | `guto-pagodeiro` | Pagodeiro | rare | camisa aberta, pandeiro na mão | chapéu panamá |
| guto | `guto-dj` | DJ do Deploy | epic | jaqueta neon, fones no pescoço, controladora | |
| guto | `guto-astronauta` | Astronauta da Nuvem | legendary | traje espacial branco com nuvens azuis | capacete de astronauta |
| guto | `guto-paladino` | Paladino da Nuvem | epic | armadura de placas, capa azul, espada e escudo com nuvem |  |
| guto | `guto-capitao` | Capitão do Deploy | epic | uniforme de capitão de navio | quepe |
| guto | `guto-tempestade` | Senhor da Tempestade | mythic | armadura azul-noite com raios dourados, lança elétrica | elmo de relâmpago |
| b1 | `b1-default` | Listras e Jeans | common (padrão) | camiseta listrada, jaqueta jeans | |
| b1 | `b1-po` | Product Owner | common | blazer, quadro kanban debaixo do braço | |
| b1 | `b1-flexbox` | Flexbox | rare | roupa com blocos coloridos alinhados | |
| b1 | `b1-lancamento` | Dia de Lançamento | epic | macacão roxo de astronauta com foguete nas costas | |
| b1 | `b1-rainha` | Rainha do CSS | legendary | vestido roxo com capa, cetro com chaves `{ }` | coroa |
| b1 | `b1-scrum` | Scrum Master | rare | colete cheio de botões e apito |  |
| b1 | `b1-arquiteta` | Arquiteta de Grid | epic | capa e compasso gigante |  |
| b1 | `b1-imperatriz` | Imperatriz do Roadmap | mythic | manto imperial roxo com estrelas | coroa gigante |
| angelo | `angelo-default` | Social e Gravata | common (padrão) | camisa social, gravata, calça social | |
| angelo | `angelo-terno` | Terno de Reunião | common | terno completo, pasta de documentos | |
| angelo | `angelo-maestro` | Maestro | rare | fraque, batuta na mão | |
| angelo | `angelo-paraninfo` | Paraninfo | epic | beca preta de formatura com faixa âmbar, canudo na mão | capelo |
| angelo | `angelo-rei` | Herança Real | legendary | manto real vermelho com arminho, cetro | coroa |
| angelo | `angelo-capitao` | Capitão da Quadra | epic | uniforme de capitão e troféu de padel |  |
| angelo | `angelo-reitor` | Reitor | epic | toga com faixa dourada | capelo |
| angelo | `angelo-chanceler` | Chanceler Supremo | mythic | toga branca e dourada, selo da universidade | coroa de louros |
| pablo | `pablo-default` | Suéter e Camisa | common (padrão) | suéter azul sobre camisa branca | |
| pablo | `pablo-cientista` | Cientista | common | jaleco branco, prancheta com fórmulas | |
| pablo | `pablo-enxadrista` | Enxadrista | rare | colete xadrez, peça de rei na mão | |
| pablo | `pablo-mago` | Mago dos Algoritmos | epic | manto azul com estrelas, cajado com árvore binária | chapéu de mago |
| pablo | `pablo-galactico` | Arquimago do Código | legendary | manto escuro com runas de prata, capuz e cajado de cristal | sim |
| pablo | `pablo-garagem` | Hacker de Garagem | legendary | jaqueta ciberpunk com neon rosa e ciano, visor holográfico, fone de ouvido | visor |
| pablo | `pablo-oraculo` | Oráculo | legendary | túnica clara e esfera de dados flutuando |  |
| pablo | `pablo-singularidade` | A Singularidade | mythic | manto de céu estrelado com galáxias | capuz |

### Cenários (31)

| id | Nome | Ambiente | Cena |
| --- | --- | --- | --- |
| `sala-de-aula` | Sala de Aula (padrão) | dust | sala com quadro branco, projetor e carteiras |
| `laboratorio` | Laboratório de Informática | code | fileiras de computadores, monitores acesos |
| `academia` | Academia Avenida | dust | academia com halteres e espelhos |
| `praia` | Prainha | leaves | praia tropical, coqueiros, mar |
| `prisao` | Prisão | dust | cela com grades, luz fria |
| `nether` | Nether | embers | caverna de lava e blocos escuros |
| `casa-automatica` | Casa Automática | none | sala de casa inteligente com painéis e luzes |
| `arena` | Arena | confetti | estádio de futebol à noite com torcida |
| `cidade` | Cidade | rain | avenida com arranha-céus à noite, neon |
| `deserto` | Exílio | dust | deserto com dunas e sol baixo |
| `templo` | Templo | leaves | templo japonês com cerejeiras |
| `datacenter` | Datacenter | code | corredor de racks com LEDs |
| `coordenacao` | Sala da Coordenação | dust | escritório com mesa, estante e diplomas na parede |
| `formatura` | Formatura | confetti | auditório com palco, cortina e faixa |
| `cantina` | Cantina | dust | cantina com balcão, estufa de salgados e mesas de plástico |
| `biblioteca` | Biblioteca | dust | estantes de madeira até o teto, mesas com abajur verde |
| `quadra-de-padel` | Quadra de Padel | none | quadra com paredes de vidro, grade e rede |
| `madrugada` | Madrugada no Laboratório | code | laboratório escuro, monitores acesos, café frio |
| `orla` | Orla do Guaíba | leaves | orla do rio ao pôr do sol, píer e árvores |
| `servidor-antigo` | Sala do Servidor Antigo | dust | torres bege, cabos embolados e um monitor de tubo |
| `feira` | Feira de Tecnologia | confetti | pavilhão com estandes, robôs pequenos e faixas |
| `estudio` | Estúdio de Podcast | none | microfones, espuma acústica e letreiro no ar |
| `espaco` | Estação Orbital | stars | janelão para a Terra e consoles acesos |
| `trofeus` | Sala dos Troféus | confetti | vitrines de taças, medalhas e certificados |
| `jardim` | Jardim do Campus | leaves | gramado, flores e cerejeira em frente ao prédio (Árvore Frondosa) |
| `grafica` | Gráfica | dust | prensas e pilhas de papel (Gráfica Sobrecarregada) |
| `por-do-sol` | Pôr do Sol no Campus | leaves | campus ao entardecer com torre de relógio (Sequência de Sete) |
| `neve` | Neve no Campus | dust | prédios cobertos de neve e fonte congelada (Volta Olímpica) |
| `castelo` | Castelo | leaves | castelo numa colina, campo e montanhas (Corpo Docente) |
| `masmorra` | Masmorra | dust | pedra, tochas e baú (Turma Enxuta) |
| `galaxia` | Galáxia | stars | nebulosas e planetas, **sem chão**: o professor flutua (floats), sem sombra de contato (todas as lendárias) |

## 7. Ritmo (metas do balanceamento)

Primeira formatura: **4 a 5 horas para o jogador casual** (1 clique/s), cerca de 3 h para o ativo e 5,5 h para o ocioso. O começo não muda: Gladimir e a terceira professora saem nos mesmos minutos de antes. O que se esticou foi o meio e o fim da primeira turma (custos dos professores 4 a 8 em 1,25x, 1,5x, 1,6x, 1,8x e 1,9x, e a base do diploma, de 2e19 para 8e20).

| Marco | Ativo | Casual | Ocioso |
| --- | --- | --- | --- |
| Gladimir | 5 min | 14 min 30 s | 33 min |
| Bruna B2 | 21 min | 31 min | 52 min |
| Wagner (4 professores) | 48 min | 1 h 01 | 1 h 26 |
| Guto | 1 h 18 | 1 h 38 | 2 h 10 |
| Bruna B1 | 1 h 48 | 2 h 25 | 3 h 04 |
| Angelo | 2 h 17 | 3 h 24 | 4 h 09 |
| Primeira formatura | 2 h 59 | 4 h 34 | 5 h 36 |
| Pablo | 5 h 02 | 7 h 07 | 9 h 25 |

Turmas seguintes (minutos por turma, simulador padrão, semente 1, com Maestrias, Monitores e homenagem automática): a 2ª dura 135 (ativo) e 172 (casual); a 12ª, 41 e 52; a 20ª, 23 e 35; da 25ª em diante o ativo fica entre 12 e 20 min e o casual em torno de 20 a 25 min até umas 80 formaturas. A curva só cai e achata, e nenhum perfil trava em 60 horas. O limite de diplomas por turma é 10 x 1,15^formaturas; o Domínio e a homenagem do Angelo esticam o limite na mesma proporção em que aumentam os diplomas. Com fator 1,3 as turmas do meio ficavam curtas demais (a 12ª do ativo em 20 min e as de 20 em diante abaixo de 10). Passando de umas 80 formaturas (mais de 100 h) o limite cresce mais depressa do que a produção e as turmas passam de uma hora.

As Maestrias e os Monitores devem encurtar as turmas tardias em 15% ou menos: Joinha, Rollforward, Super invasão, Festa de lançamento e Releases foram reduzidos para isso, e os níveis das Maestrias custam 75, 225, 525 e 1.125 diplomas.

O simulador (`npm run sim`) joga com estratégia gulosa (compra o que tem melhor retorno) mais uma taxa fixa de cliques, usa as Maestrias e os Monitores e homenageia um professor a cada formatura (`--honour`). `npx tsx src/game/sim/longrun.ts` faz uma simulação longa e imprime o momento de cada conquista que dá visual, os marcos dos candidatos a skin mítica e a formatura "relâmpago".

## 8. Interface

- Desktop: palco à esquerda (cenário, professor em sala, contador, combo, habilidades, sprint, invasões), painel à direita com abas (Aulas, Pesquisas, Álbum, Formatura, Config). Celular: palco em cima, painel embaixo.
- Tema escuro, moldura de pixel, cor de destaque do professor em sala. Fonte de display pixelada, texto corrido legível.
- Animação é onde o jogo impressiona: squash no clique, tremor no crítico, moedas voando até o contador, contador contínuo, cerimônia de skin por raridade, cenas de tela cheia para contratação e formatura.
- Som sintetizado em WebAudio (estilo chiptune): clique, crítico, compra, marco, conquista, invasão, formatura. Música de fundo opcional, desligada por padrão.
- Formatação de números em pt-BR: `1.234`, `12,5 K`, `3,21 M`, B, T, Qa, Qi, Sx, Sp, Oc, No, Dc e depois notação científica.
