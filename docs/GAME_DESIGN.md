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

O **professor em sala** é o alvo do clique e pode ser trocado a qualquer momento entre os contratados. As disciplinas de quem está em sala rendem ×1,5 (`activeBonus`).

### Personalidades (para falas e nomes; humor leve, nunca sobre a pessoa)

- **Edécio**: o mais sério, mas fala tudo sorrindo. Bordões: "Muito legal!", joinha 👍, "Parabéns!". Humor involuntário.
- **Gladimir**: o mais piadista. Muito nerd, fã de Star Wars; trocadilhos de banco de dados com referências galácticas ("Que o JOIN esteja com você"). Pode ser bem engraçado.
- **Guto**: o da resenha. Gosta de curtir e fazer piada. Sem referência direta a bebida.
- **Angelo**: formal, coordenador, mas solta piada seca no meio da formalidade.
- **Pablo**: se acha (e é) muito inteligente, de leve. Faz piada com isso.
- **Wagner, Bruna B1, Bruna B2**: ainda sem informação. Tom neutro e simpático, humor só da disciplina (senha fraca, pixel fora do lugar, backlog infinito).

## 3. Upgrades

Três tipos, sempre ligados a um professor.

- **Disciplinas** (24 = 3 por professor): têm nível, geram ADScoins/s. A disciplina de tier 0 abre ao contratar; a de tier n abre quando a de tier n-1 chega ao nível 10.
- **Upgrades de clique** (6 no total, espalhados): têm nível, somam valor ao clique.
- **Pesquisas** (~40, 4 a 6 por professor): compra única. Efeitos por `Effect`. É aqui que a mecânica de cada professor melhora.

Fórmulas (todas as constantes em `BalanceConfig`):

- Custo do nível seguinte: `baseCost × growth^level × costMult`, com `growth = max(minCostGrowth, costGrowth + stat(costGrowth))`. Base `costGrowth = 1.15`, `minCostGrowth = 1.07`.
- Marcos: nos níveis 10, 25, 50, 100, 200 e depois a cada 100, a saída daquele upgrade dobra.
- Produção de uma disciplina por segundo:
  `baseProduction × level × 2^marcos × disc × prof × idlePower × globalPower × (em sala ? activeBonus : 1) × (1 + synergy × outrosProfessoresContratados)`
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
- Temas da HUD: só cores (fundo, superfícies, bordas, texto). 5 temas: padrão escuro, claro, alto contraste, terminal verde, pastel. Liberados por conquistas.

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
- **Formatura** (prestígio): disponível com o Angelo contratado. `diplomas = floor((runCoins / base)^exponent × diplomaGain)`, com `base = 2e19` e `exponent = 0.5`: a primeira formatura de um jogador ativo (cerca de 2 h 45) rende uns 10 diplomas, e cada formatura seguinte exige 4× mais ADScoins da corrida para dobrar os diplomas dela. Só pode formar se ganhar pelo menos 1.
- Zera: moedas, `runCoins`, níveis, pesquisas, contratações (menos Edécio e os mantidos por nós de prestígio), buffs, invasão, sprint, combo, recargas.
- Mantém: diplomas, árvore, conquistas, skins, cenários, temas, contadores, configurações.
- **Árvore de prestígio**: ~20 nós em 4 ramos — `core` (tronco: produção global, manter professores, ganho de diplomas), `click`, `idle`, `events`. Nós têm nível máximo e custo crescente (1 a 30 diplomas no primeiro nível, dobrando a cada nível; a árvore inteira custa ~1.900 diplomas, algo como 12 formaturas).

### Complexidade (Pablo)
- Pesquisas caras que reduzem `costGrowth` em 0,01 cada (até 1,10) e dão multiplicadores grandes. É o conteúdo de fim de jogo.

## 5. Conquistas

~90. Cada conquista dá +1% de produção global. Algumas dão skin, cenário ou tema.

| Família | Quantas | Exemplos |
| --- | --- | --- |
| `click` | ~14 | 100 / 1k / 10k / 100k cliques; 100 críticos; combo máximo |
| `production` | ~16 | marcos de ADScoins totais e de ADScoins/s |
| `professor` | ~24 | contratar cada um; todas as disciplinas de X no nível 25 / 50 / 100; todas as pesquisas de X |
| `events` | ~8 | defender 10 / 50 / 250; sequência de 10 / 25 |
| `sprints` | ~6 | concluir 5 / 25 / 100 sprints |
| `graduation` | ~8 | 1 / 5 / 10 / 25 formaturas; diplomas ganhos; nós da árvore |
| `collection` | ~6 | ter N skins; N conquistas |
| `secret` | ~8 | descritas como "???" até acontecer |

Gatilhos secretos que a UI dispara com `triggerSecret(id)`: `logo-clicks` (clicar 10× no logo), `konami` (código Konami), `night-owl` (jogar entre 3h e 5h), `swap-spree` (trocar de professor 20× em 1 minuto), `idle-watcher` (1 minuto sem clicar com o jogo aberto), `joinha` (digitar "muito legal"). Os outros secretos usam condições normais.

Toda skin não padrão, todo cenário não padrão e todo tema não padrão é recompensa de exatamente uma conquista.

## 6. Skins e cenários (lista fechada: os ids valem para conteúdo e arte)

Pixel art caricato: corpo pequeno, cabeça grande. **Corpo e cabeça são camadas separadas.** A skin é o corpo (sem cabeça, termina num toco de pescoço); a cabeça pertence ao professor (`heads/<professorId>`). Uma skin com chapéu ou capacete tem a própria cabeça, o professor desenhado já usando o acessório (`heads/<skinId>`); enquanto essa arte não existe, vale a cabeça normal do professor.

Arquivos em `public/assets/`: `skins/<skinId>.png`, `heads/<professorId>.png`, `heads/<skinId>.png` (cabeça com acessório), `sceneries/<sceneryId>.png`. Skin id = `<professor>-<slug>`.

### Skins (48)

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
| gladimir | `gladimir-default` | Xadrez de Sempre | common (padrão) | camisa xadrez, calça cáqui, crachá | |
| gladimir | `gladimir-dba` | DBA de Plantão | common | colete, cabo de rede no ombro, caneca "SELECT *" | |
| gladimir | `gladimir-maker` | Maker IoT | rare | jaleco com sensores e LEDs, protoboard na mão | óculos de proteção |
| gladimir | `gladimir-piloto` | Piloto Rebelde | epic | macacão laranja de piloto espacial, colete branco | capacete de piloto |
| gladimir | `gladimir-stormtrooper` | Stormtrooper | epic | armadura branca de soldado imperial, blaster | |
| gladimir | `gladimir-mestre` | Mestre da Galáxia | legendary | túnica bege de cavaleiro espacial, sabre de luz azul | capuz |
| gladimir | `gladimir-vader` | Darth Gladimir | legendary | armadura negra, capa, sabre de luz vermelho, capacete debaixo do braço | |
| b2 | `b2-default` | Blazer Rosa | common (padrão) | blazer rosa, camiseta branca, calça preta | |
| b2 | `b2-postit` | Mural de Post-its | common | roupa coberta de post-its coloridos, caneta na mão | |
| b2 | `b2-wireframe` | Wireframe | rare | roupa cinza com caixas e X de wireframe | |
| b2 | `b2-darkmode` | Dark Mode | epic | toda de preto com detalhes neon roxos | |
| b2 | `b2-paleta` | Paleta Viva | legendary | vestido em degradê arco-íris, pincel gigante | |
| wagner | `wagner-default` | Preto Básico | common (padrão) | camiseta preta, calça cargo, crachá | |
| wagner | `wagner-hacker` | Capuz Verde | common | moletom com capuz e código verde, notebook | |
| wagner | `wagner-agente` | Agente Secreto | rare | terno preto, gravata fina, fone espiral | óculos escuros |
| wagner | `wagner-firewall` | Firewall | epic | armadura de tijolos com chamas laranja | |
| wagner | `wagner-cripto` | Cavaleiro da Criptografia | legendary | armadura prateada com cadeado no peito, escudo com chave | elmo |
| guto | `guto-default` | Camisa Florida | common (padrão) | camisa havaiana, bermuda, chinelo | |
| guto | `guto-churrasqueiro` | Mestre do Churrasco | common | avental, espeto na mão, pano no ombro | |
| guto | `guto-pagodeiro` | Pagodeiro | rare | camisa aberta, pandeiro na mão | chapéu panamá |
| guto | `guto-dj` | DJ do Deploy | epic | jaqueta neon, fones no pescoço, controladora | |
| guto | `guto-astronauta` | Astronauta da Nuvem | legendary | traje espacial branco com nuvens azuis | capacete de astronauta |
| b1 | `b1-default` | Listras e Jeans | common (padrão) | camiseta listrada, jaqueta jeans | |
| b1 | `b1-po` | Product Owner | common | blazer, quadro kanban debaixo do braço | |
| b1 | `b1-flexbox` | Flexbox | rare | roupa com blocos coloridos alinhados | |
| b1 | `b1-lancamento` | Dia de Lançamento | epic | macacão roxo de astronauta com foguete nas costas | |
| b1 | `b1-rainha` | Rainha do CSS | legendary | vestido roxo com capa, cetro com chaves `{ }` | coroa |
| angelo | `angelo-default` | Social e Gravata | common (padrão) | camisa social, gravata, calça social | |
| angelo | `angelo-terno` | Terno de Reunião | common | terno completo, pasta de documentos | |
| angelo | `angelo-maestro` | Maestro | rare | fraque, batuta na mão | |
| angelo | `angelo-paraninfo` | Paraninfo | epic | beca preta de formatura com faixa âmbar, canudo na mão | capelo |
| angelo | `angelo-rei` | Herança Real | legendary | manto real vermelho com arminho, cetro | coroa |
| pablo | `pablo-default` | Suéter e Camisa | common (padrão) | suéter azul sobre camisa branca | |
| pablo | `pablo-cientista` | Cientista | common | jaleco branco, prancheta com fórmulas | |
| pablo | `pablo-enxadrista` | Enxadrista | rare | colete xadrez, peça de rei na mão | |
| pablo | `pablo-mago` | Mago dos Algoritmos | epic | manto azul com estrelas, cajado com árvore binária | chapéu de mago |
| pablo | `pablo-galactico` | Cérebro Galáctico | legendary | traje cósmico brilhante, aura de estrelas | |

### Cenários (14)

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

## 7. Ritmo (metas do balanceamento)

| Marco | Tempo de jogo ativo |
| --- | --- |
| Primeiro upgrade | 10 s |
| Gladimir | 5 min |
| Primeira skin por conquista | 8 min |
| 4 professores | 45 min |
| Angelo e primeira formatura | 2 a 3 h |
| Pablo | depois da primeira formatura |

O simulador (`npm run sim`) joga com estratégia gulosa (compra o que tem melhor retorno) mais uma taxa fixa de cliques, e imprime quando cada marco acontece.

## 8. Interface

- Desktop: palco à esquerda (cenário, professor em sala, contador, combo, habilidades, sprint, invasões), painel à direita com abas (Aulas, Pesquisas, Álbum, Formatura, Config). Celular: palco em cima, painel embaixo.
- Tema escuro, moldura de pixel, cor de destaque do professor em sala. Fonte de display pixelada, texto corrido legível.
- Animação é onde o jogo impressiona: squash no clique, tremor no crítico, moedas voando até o contador, contador contínuo, cerimônia de skin por raridade, cenas de tela cheia para contratação e formatura.
- Som sintetizado em WebAudio (estilo chiptune): clique, crítico, compra, marco, conquista, invasão, formatura. Música de fundo opcional, desligada por padrão.
- Formatação de números em pt-BR: `1.234`, `12,5 K`, `3,21 M`, B, T, Qa, Qi, Sx, Sp, Oc, No, Dc e depois notação científica.
