# ADSClicker — Laboratório de Pesquisa (motor e store)

Mini-jogo roguelike alcançado pela sala de aula. Reaproveita o conteúdo do modo Hackathon (que continua desligado): as 24 bases de item, as raridades, os inimigos, os buffs de onda e o conjunto Kit Plantão. Este arquivo descreve o **motor e a store**; a interface vem depois. Todos os números ficam em um lugar só: `src/game/content/lab.ts` (tipos em `src/game/content/labTypes.ts`). O motor está em `src/game/engine/lab/`.

## Decisões do dono

- **Liberação:** depois de contratar o Pablo aparece um 9º "professor", o Laboratório. Desbloquear custa **30 diplomas, uma vez** (`lab.unlocked`, permanente). O bônus de produção usa `diplomasEarned`, então nada se perde.
- **Porta por turma:** a corrida e o inventário só existem na turma quando **toda aula (disciplina) está no nível 1 ou mais**. A regra é uma função só, `labRunAvailable`, que devolve o motivo para a interface ("Faltam 5 aulas").
- **Uma corrida por turma.** Monitor quebrado (`status: 'broken'`) encerra o Laboratório até a próxima formatura. Itens e buffs continuam valendo no clicker até lá.
- **A corrida só anda com o Laboratório aberto** (`setLabOpen`). Fechado = pausado. Sem progresso offline: cada tick alimenta a corrida com no máximo 2 s reais.
- **Formatura:** a corrida, os itens equipados e os buffs somem. Ficam o desbloqueio, os Commits, a árvore e os recordes. Uma corrida ainda em andamento é paga como se tivesse quebrado ali (Commits das fases e chefões).

## Conteúdo próprio do Laboratório (fases avançadas)

Além do que vem do Hackathon, o Laboratório tem **24 bases de item** (6 por espaço, `content/labItems.ts`, arte em `lab/items/`) e **7 inimigos** (5 comuns e 2 chefões, `content/labEnemies.ts`, arte em `lab/enemies/`).

- **Itens:** só caem a partir de `fromPhase` (fase 8 depois do primeiro chefão, 10 e 13 para os melhores; constantes `LAB_ADVANCED_FROM` e `LAB_LATE_FROM`). Mesmas raridades e a mesma tabela de afixos; o lendário usa efeitos lab-only (`skillBonuses`, ids próprios), `secondWind` ou `critSplash`. Conjunto novo: Guilda dos Professores (2 e 4 peças). O Setup de casa da árvore só sorteia bases sem `fromPhase`.
- **Inimigos comuns** (`enemyFrom`): Bug de VibeCoder (fase 6), Select sem WHERE (8), Alucinação de IA (9), Prompt Injection (11), Agente em loop (13).
- **Chefões** (`run.bossCycle`, a ordem a cada 5ª fase): fase 5 Deploy de Sexta, 10 Select sem WHERE em produção, 15 A IA que Apagou o Banco, 20 volta ao Deploy e assim por diante (`bossFor`).

## Estado (`GameState.lab`)

```
lab: {
  unlocked, open,                 // open nunca é lido como true de um save
  commits, tree: {id: nível},     // permanentes
  treeVersion,                    // versão da árvore em que os níveis foram comprados (ver Commits e árvore)
  bestPhase,                      // fase mais alta alcançada (quebrar na 7 conta 7)
  bestPhaseBuild, bestRunBuild,   // itens equipados no recorde de fase e na melhor turma (ver "Recordes e builds")
  counters: { runs, broken, phasesCleared, bossesBeaten, itemsFound, itemsRecycled,
              itemLevelUps, affixRerolls, clicks, commitsEarned },
  turma: {                        // zerada na formatura
    run: null | {
      seed, status: 'fighting'|'reward'|'equip'|'broken',
      phase, t, phaseTime, carry,
      integrity, maxIntegrity,
      mobs[], mobSeq, waveHp, bossLeft, nextCharge,
      offers[], pending,          // recompensa em tela / item esperando decisão
      shield, rerolled,           // escudo da fase / sorteios de recompensa já usados (árvore)
      buffs: {id: vezes}, clickTimes[], windUsed,
      cleared, bosses, clearLog[],// clearLog = t (s) em que cada fase foi vencida
      brokenBy, paid
    },
    equipped: { ferramenta?, setup?, acessorio?, amuleto? },  // LabItem
    nextUid
  }
}
```

`LabItem = { uid, base, rarity, level, affixes: [{target, op, value}], rerolls }`. `value` é o que a linha rolou no nível 1 (multiplicador de raridade incluso); o valor efetivo é `value x (1 + 0,12 x (nível - 1))`.

Leitor tolerante em `engine/lab/save.ts`: save antigo (sem `lab`) vira laboratório trancado e vazio; lixo cai no padrão; ids que não existem somem; um item só entra no espaço da sua base; o valor de cada linha é preso entre o mínimo e o máximo que a raridade permite, o nível ao máximo (20), os buffs a 99 pilhas; uma corrida num laboratório não desbloqueado é descartada; uma corrida inconsistente (luta sem monstros, recompensa sem opções, item pendente sumido) é refeita a partir da semente.

## A corrida

Passo fixo de 0,1 s, independente da frequência do tick (o resultado é o mesmo para a mesma semente e as mesmas escolhas).

| Regra | Número |
| --- | --- |
| Início | só o **Mouse quebrado** (ferramenta, poder 5, sem buff de clicker); integridade 100 |
| Dano automático | `soma do poder dos itens x (1 + bônus de dano)`; chefão soma o bônus de dano em chefões |
| Poder do item | `5 x raridade[1; 1,7; 3; 5,4; 10] x 1,15^(nível-1)` |
| Clique no monitor | 4% do dano automático por clique; no máximo **5 cliques contam por segundo** (janela móvel) = no máximo +20% |
| Onda | 2..6 monstros: 2 + 1 a cada 3 fases, +0 ou +1 pela semente. Tipos liberados por fase (bug 1, loop 2, merge 3, vazamento 4, legado 6) |
| HP | HP do Hackathon x 0,178 x 1,14^(fase-1). Chefão: x 0,54 x 2,6 no 2º chefão em diante (`bossHpGrowth`, 1 só vez: `bossGrowthTurns`) |
| Dreno | dano x ataques/s do inimigo x 0,05 x 1,12^(fase-1) por segundo, com `ramp` (vazamento, chefão) e carga do chefão (golpe a cada 9 s). `armor` vira redução de dano (8% por ponto, máx. 50%); `split` do Conflito de merge vale |
| Chefão | toda 5ª fase, **30 s** de prazo (+ árvore; Hotfix só no primeiro). Prazo zerado ou integridade 0 = monitor quebra |
| Segundo fôlego | uma vez por fase (por carga), a queda fatal deixa 15% da integridade |

Ordem de um passo: dano, fase vencida?, dreno, golpe do chefão, integridade, prazo.

### Recompensas

Ao vencer uma fase: **3 opções** (4 na primeira com a árvore; +1 pela chance de "opção extra" dos itens, até 5). A primeira é sempre item; as demais sorteiam por peso item 3, buff 3, Commits 1,5, reparo 1,5 (reparo x2,5 com o monitor abaixo de 50%). Mentoria: +1 opção no chefão. Retrospectiva: sorteia de novo as opções (`rerollLabOffers`, uma vez por nível por recompensa, mesma semente, fluxo seguinte). Chefão: duas opções de item, a primeira **raro ou melhor** e a segunda **incomum ou melhor**.

- **Item:** base sorteada (espaços vazios pesam 2), raridade pelos pesos do Hackathon deslocados pela qualidade de loot `sorte + 1,5 x (fase-1)` (cada ponto multiplica o peso de rank i por `1 + q/100 x i`, teto 400), nível `1 + floor((fase-1)/3)` (+1 em chefão). Vaga livre equipa na hora; vaga ocupada deixa o item **pendente**: `equipLabPending` (o antigo é reciclado em Commits) ou `recycleLabPending` (recicla o novo).
- **Buff da corrida:** um dos 12 (10 dos buffs de onda do Hackathon, adaptados, mais Prazo estendido e CI verde). Vale até a formatura, empilha, e também age no clicker.
- **Commits:** `8 x (1 + 0,12 x (fase-1)) x bônus`.
- **Reparo:** 25% da integridade máxima (40% em chefão).

Tudo sai de streams determinísticos da semente (`createStream` do Hackathon, em `engine/lab/state.ts`): onda por fase, opções por fase, reroll por item e número de rerolls, itens iniciais. A semente é sorteada pela **store** (`rng()`), nunca pelo motor. `clearLog` guarda o tempo de cada fase vencida para uma checagem futura no servidor.

## Itens: poder e buffs de clicker

O poder (dano no laboratório) vem só de raridade e nível. Os afixos viram buffs de clicker pela tabela `lab.affixes`, somados com `op: 'add'` pelo `Accumulator` de `computeStats` (`engine/lab/effects.ts`):

| Afixo (Hackathon) | Clicker | Por ponto (add) / por % (pct) |
| --- | --- | --- |
| lógica | `clickPower` | +2% / +1% |
| agilidade | `comboMax` e `comboDecay` | +0,15 passo e -0,6% / +0,05 e -0,3% |
| foco | `abilityDuration` | +0,3% / +1% |
| resiliência | `eventWindow` | +1,5% / +1% |
| atenção | `critChance` | +1 pp / +0,5 pp |
| cooldown | `abilityCooldown` | -0,8% |
| bossDamage | `eventReward` | +1% |
| commitsGain | `sprintReward` | +1% |
| skillPower | `activeBonus` | +0,5% |
| sorte, lootQuality | só laboratório: qualidade de loot | +1 |
| dropExtra | só laboratório: % de opção extra | +1 |
| xpGain | só laboratório: +1% de Commits | |

Um lendário nível 10 com a melhor rolagem na linha principal fica em torno de +20% a +50% no atributo dele. **Nenhum efeito do laboratório toca produção bruta** (`globalPower`, `idlePower`). Tetos somados de tudo (itens, conjunto, buffs, depois da árvore): `clickPower` +3, `comboMax` +60, `comboDecay` -0,7, `abilityDuration` +2, `eventWindow` +2, `critChance` +0,45, `abilityCooldown` -0,6, `eventReward` +3, `sprintReward` +3, `activeBonus` +1,5.

**Únicos (só na versão lendária):** `modifiers` passam pela mesma tabela; `skill`: Deploy = +15% de dano, Refatorar = repara 3% por fase, Firewall = -15% de dreno, Café duplo = recarga -15% no clicker e +10% de dano; `secondWind` = uma carga de segundo fôlego; `critSplash` = +0,15 pp de crítico e +0,2% de dano por ponto de chance. **Kit Plantão:** 2 peças (+8% lógica, +8% foco) e 4 peças (skillPower +25, cooldown +15, resiliência +10), pela mesma tabela. Buffs de corrida: cada modificador do buff do Hackathon pela mesma tabela, vezes as pilhas; a árvore (`documentacao`) soma +10% por nível em tudo que o laboratório dá ao clicker.

## ADScoins

Números fixos (strings decimais), um degrau acima do Pablo (1,52e21), não minutos de produção. **Em qualquer momento** com o Laboratório desbloqueado (em luta, entre lutas, aberto ou fechado).

- **Subir nível** (`levelUpLabItem`): `1e24 x 10^raridade x 6^(nível-1)`; nível máximo 20. Dá +15% de poder e +12% do valor dos afixos por nível.
- **Rerrolar um afixo** (`rerollLabAffix`, índice 0 mantém o alvo e sorteia valor novo; os demais sorteiam alvo novo do pool da base): `2e23 x 10^raridade x 3^(nível-1) x 2^(rerrolagens do item)`. Sempre mais barato que subir o nível do mesmo item.

## Commits e árvore

- **Quebrar o monitor** paga `(fases vencidas x 3 + chefões x 25) x bônus`; **reciclar** paga `5 / 12 / 30 / 80 / 250` por raridade, +10% por nível acima de 1.
- **Árvore permanente** (`lab.tree`, 34 nós, 3 ramos, 5 camadas, comprados com Commits, `custo x crescimento^nível`; `content/labTree.ts`, todos os preços passam por `TREE_PRICE`). Cada nó pede um nó da camada anterior; três capstones pedem também um nó de outro ramo (Deploy contínuo <- Rede segura, Datacenter próprio <- Portfólio, Unicórnio <- TDD).

| Ramo | Nó | Níveis | Custo | Total | Efeito | Requer |
| --- | --- | --- | --- | --- | --- | --- |
| Código | 🧠 Algoritmos eficientes | 10 | 12 x 1.45^nível | 1074 | +6% de dano automático por nível. | - |
| Código | 📖 Estudo de chefão | 6 | 25 x 1.5^nível | 522 | +12% de dano em chefões por nível. | Algoritmos eficientes |
| Código | 🪑 Setup de casa | 1 | 60 | 60 | Toda corrida começa com um item comum no Setup, além do mouse quebrado. | Algoritmos eficientes |
| Código | ✂️ Minimalismo | 3 | 40 x 1.8^nível | 242 | +10% de dano automático por espaço vazio, por nível. Quem tem pouco ainda ataca. | Algoritmos eficientes |
| Código | ⚡ Hotfix | 3 | 90 x 1.7^nível | 504 | +6 segundos no prazo do primeiro chefão de cada corrida, por nível. | Estudo de chefão |
| Código | 🧪 TDD | 4 | 80 x 1.6^nível | 741 | Cada chefão derrotado paga +15 Commits na hora, por nível. | Estudo de chefão |
| Código | 🏃 Speedrun | 4 | 70 x 1.6^nível | 649 | Vencer uma fase comum em menos de 10 s repara 2% da integridade, por nível. | Minimalismo |
| Código | 🎒 Estagiário dedicado | 2 | 260 x 3^nível | 1040 | A corrida começa com +1 item incomum sorteado num espaço vazio, por nível. | Setup de casa |
| Código | 🧬 Herança de código | 3 | 420 x 2.2^nível | 3377 | O item novo herda 30% do nível do que ele substitui, por nível. | Estagiário dedicado |
| Código | 🏆 Código lendário | 3 | 500 x 2^nível | 3500 | +50% de dano automático por item lendário equipado, por nível. | Hotfix |
| Código | 🚀 Deploy contínuo | 1 | 4200 | 4200 | +80% de dano automático e +60% em chefões. Pede Código lendário e Rede segura. | Código lendário + Rede segura |
| Infra | 🖥️ Monitor reforçado | 10 | 10 x 1.38^nível | 639 | +8 de integridade máxima por nível. | - |
| Infra | 💾 Backup noturno | 5 | 25 x 1.55^nível | 364 | Repara 5% da integridade depois de cada chefão, por nível. | Monitor reforçado |
| Infra | ⏱️ Prazo folgado | 5 | 30 x 1.6^nível | 475 | +4 segundos no prazo dos chefões por nível. | Monitor reforçado |
| Infra | ❄️ Cooler turbinado | 5 | 20 x 1.5^nível | 265 | Repara 1% da integridade depois de cada fase, por nível. | Monitor reforçado |
| Infra | 🔒 Rede segura | 6 | 40 x 1.55^nível | 937 | Os mobs drenam 3% menos integridade por nível. | Backup noturno |
| Infra | 🔋 Nobreak do laboratório | 1 | 450 | 450 | Uma vez por fase, uma queda fatal deixa o monitor com 15% de integridade. | Prazo folgado |
| Infra | 🧱 Firewall do lab | 4 | 55 x 1.7^nível | 579 | Toda fase começa com um escudo de 6% da integridade máxima, por nível. | Cooler turbinado |
| Infra | 📺 Monitor ultrawide | 5 | 70 x 1.6^nível | 1108 | +4% de integridade máxima por nível. | Firewall do lab |
| Infra | 🛡️ Zero trust | 4 | 220 x 1.9^nível | 2942 | Mais 4% de redução do dreno por nível, somando com a Rede segura. | Rede segura |
| Infra | 🔌 Gerador de emergência | 1 | 1800 | 1800 | Mais uma carga de segundo fôlego por fase. | Nobreak do laboratório |
| Infra | 🏢 Datacenter próprio | 1 | 3600 | 3600 | +25% de integridade máxima, +3% de reparo por fase e +10% após chefões. Pede Zero trust e Portfólio. | Zero trust + Portfólio |
| Produto | 🔍 Revisão de PR | 1 | 30 | 30 | A primeira recompensa da corrida mostra 4 opções. | - |
| Produto | ✨ Código limpo | 8 | 15 x 1.5^nível | 741 | +4 de sorte por nível: mais chance de itens raros e lendários. | Revisão de PR |
| Produto | 📚 Documentação | 5 | 20 x 1.55^nível | 291 | Os buffs do Laboratório valem 8% mais no clicker, por nível. | Revisão de PR |
| Produto | 🔁 Retrospectiva | 2 | 300 x 3.5^nível | 1350 | Sorteia de novo as opções de cada recompensa, uma vez por nível. | Revisão de PR |
| Produto | 📁 Portfólio | 5 | 40 x 1.7^nível | 756 | +12% de Commits por nível. | Código limpo |
| Produto | ♻️ Reciclagem | 5 | 45 x 1.6^nível | 713 | Itens reciclados pagam 20% mais Commits, por nível. | Código limpo |
| Produto | 🖱️ Mouse gamer | 5 | 25 x 1.5^nível | 332 | +4% de ADScoins por clique no clicker, por nível. | Documentação |
| Produto | ☕ Cafeína | 5 | 35 x 1.55^nível | 509 | Habilidades dos professores recarregam 2% mais rápido, por nível. | Documentação |
| Produto | 🏷️ Licenças educacionais | 5 | 60 x 1.65^nível | 1038 | Subir o nível de itens com ADScoins custa 8% menos, por nível. | Documentação |
| Produto | 🎯 Mira afiada | 4 | 45 x 1.6^nível | 418 | +1,5 ponto de chance de crítico no clicker, por nível. | Mouse gamer |
| Produto | 🎓 Mentoria | 1 | 700 | 700 | A recompensa de um chefão mostra uma opção a mais. | Retrospectiva |
| Produto | 🦄 Unicórnio | 1 | 4800 | 4800 | +15 de sorte, +30% de Commits e +10% de chance de opção extra. Pede Portfólio e TDD. | Portfólio + TDD |

Total: 40746 Commits (34 nós)

Novos efeitos do motor (`LAB_EFFECT_KEYS`): `startItem`, `firstBossTime`, `offerRerolls`, `fastClearRepair` (limite `run.fastClearSeconds` = 10 s), `bossOptions`, `levelKeep` (teto 90%), `phaseShield`, `bossCommits`, `emptySlotDamage`, `legendaryDamage`, `levelCost` (teto de 90% de desconto) e `recycleBonus`; nós também podem dar bônus pequenos ao clicker (`clicker` por nível), sempre sob os tetos de `caps`. Cada um tem teste em `lab.test.ts`.

### Resetar a árvore

`resetLabTree` devolve **todos** os Commits gastos na árvore e zera os níveis. É de graça e sem limite de vezes, mas **só fora de uma corrida**: sem corrida (antes de começar, ou depois da formatura) ou com o monitor quebrado. Em luta, escolhendo recompensa ou decidindo um item, não (`labTreeResetCheck` devolve o motivo em pt-BR). A regra é mais estrita que "só fora da luta" de propósito: resetar entre uma fase e outra deixaria o jogador regastar os mesmos Commits no que a próxima fase pede (prazo antes do chefão, dano depois). Evento `labTreeReset { refunded }`; ação da store `resetLabTree`. A interface (Progressão) mostra o botão com um modal que diz quantos Commits voltam.

### Saves antigos

`lab.treeVersion` marca a árvore em que os níveis foram comprados (`LAB_TREE_VERSION`, hoje 1). Ao ler um save com versão diferente (ou sem, a árvore de 12 nós) a árvore **não é lida**: cada Commit gasto volta para a carteira, calculado pelos preços antigos (`legacyTree`), e a árvore começa vazia. Ids removidos ou renomeados dentro da versão atual somem sem reembolso (não acontece sem mudar a versão). Uma versão futura desconhecida zera a árvore sem reembolso.

### Renda de Commits (simulador)

Quebrar o monitor paga `(fases x 3 + chefões x 25)` mais os bônus; somando reciclagem, ofertas de Commits, TDD e Portfólio, a mediana de Commits por corrida medida: **fase 5: 20 a 30**, **fase 10: 70 a 115**, **fase 15: 210 (árvore pequena) a 800 (um quarto da árvore)**, **fase 20: cerca de 800 a 1.500**, **fase 30: cerca de 4.300** (árvore cheia). Um jogador simulado que gasta tudo no mais barato disponível, com prioridade para dano e sobrevivência, compra os 40.746 Commits da árvore em **52 corridas**.
## Pontos de integração

- `engine/stats.ts`: `computeStats` soma `labClickerEffects` depois dos buffs ativos.
- `engine/tick.ts`: `advance` chama `advanceLab` com o tempo real do tick.
- `engine/prestige.ts`: `graduate` chama `resetLabForGraduation`.
- `engine/save.ts`: `readLab` + `settleLabAfterLoad`; `engine/init.ts`: `createLabState`.
- Eventos (`store/types.ts`): `labUnlocked`, `labRunStarted`, `labPhaseCleared`, `labBossBeaten`, `labBroken`, `labItemGained`, `labItemRecycled`, `labItemChanged`, `labNodeBought`, `labTreeReset`, `labOffersRerolled`. A interface trata `labUnlocked`, `labBossBeaten` e `labBroken` em `handleGameEvent.ts`.
- Store (`GameActions`): `unlockLab`, `setLabOpen`, `startLabRun`, `labClick`, `chooseLabReward`, `equipLabPending`, `recycleLabPending`, `levelUpLabItem`, `rerollLabAffix`, `buyLabNode`, `resetLabTree`, `rerollLabOffers`.
- Views (`engine/lab/views.ts`, hooks em `store/labHooks.ts`): `labSlotView` (o 9º slot), `labMonitorView`, `labBenchView`, `labRewardsView`, `labTreeView`.

## Servidor

O servidor lê o save com o mesmo `deserializeState` e julga com `computeStats`, então os buffs do laboratório entram na conta de verossimilhança sozinhos. Medido com o simulador (`plausibility.lab.test.ts`): o pior caso de uma compra honesta com 4 lendários nível 20, árvore cheia e todos os buffs empilhados usa cerca de 14% do teto de moedas, igual a jogar sem laboratório. O que um save forjado ganha é limitado pelos tetos acima e pelo leitor (valores presos ao que a raridade rola, nível 20). O ranking do Laboratório (`bestPhase` e a melhor turma, cada um com a build do recorde) está descrito em `docs/BACKEND.md` ("Ranking do Laboratório"): as regras de plausibilidade ficam em `players/labRecords.ts`. Revalidar a corrida inteira pela semente e pelo `clearLog` continua sendo uma evolução possível.

## Recordes e builds

`lab.bestPhaseBuild` e `lab.bestRunBuild` guardam os itens equipados (slot, base, raridade, nível) no momento do recorde: o `bestPhase` copia a build quando sobe e renova a cópia quando a corrida que está nele termina (quebra ou formatura); a melhor turma (`records.mostCoins`) copia na formatura que bate o recorde. Leitor tolerante em `engine/lab/build.ts`. A interface mostra a build no Ranking do Laboratório, a aba nova ao lado de Pesquisa e Progressão (a Loja do Laboratório é só um botão por enquanto).

## Balanceamento

Medido com o jogador simulado de `engine/__fixtures__/labBot.ts` (escolhe o melhor item, buff de dano e reparo quando machucado, 5 cliques por segundo, usa o sorteio de recompensa quando a melhor opção é fraca) e fixado em `engine/lab/pacing.test.ts` (sementes fixas, 400 corridas sem árvore). `LAB_SIM=1 LAB_RUNS=300 npx vitest run src/game/engine/lab/pacing.test.ts` imprime a planilha em `LAB_OUT`; `LAB_TUNE='{"run.hpScale":0.2}'` testa um número sem editar o conteúdo.

| Cenário | Meta | Medido |
| --- | --- | --- |
| Sem árvore, vencer o chefão da fase 5 | 35 a 55% | 46% |
| Sem árvore, vencer o chefão da fase 10 | menos de 3%, só com épico/lendário | 1%, todas as corridas com item épico ou melhor |
| Sem árvore, mediana de fase | 5 a 6 | 5 (p90 10) |
| Sem árvore + 1e26 ADScoins em níveis | mais fácil, ainda raro passar da 10 | chefão 5: 71%, chefão 10: 2% |
| Um quarto da árvore (`custo/4`, o mais barato primeiro) | mediana 12 a 22 | 15 (p10 15, p90 25) |
| Metade da árvore | - | 28 |
| Árvore cheia | mediana 25 a 35, p90 acima de 33 | 30 (p10 25, p90 38, máx. 44) |
| Campanha inteira | 40 a 80 corridas | 52 |

Números: HP 0,178 x 1,14^(fase-1); chefão 0,54 do HP base, x 2,6 a partir do 2º chefão (uma vez); dreno 0,05 x 1,12^(fase-1); itens como antes. A meia árvore não fica em 12 a 16 porque metade dos Commits já compra quase todo o poder (o resto são capstones e utilidades): a mediana de 12 a 16 é de **um quarto** da árvore. A partir da fase 15 as mortes se concentram nos chefões (fases 15, 25, 30), pelo prazo; a corrida nunca é infinita (máx. 44 no simulador, teste exige menos de 80).

## Cosméticos e Loja do Laboratório

Tudo em `content/labCosmetics.ts` (preços em um lugar só, em degraus fixos de ADScoins; é um ralo de moedas). Estado permanente em `lab.cosmetics` = `{ owned: {id: true}, monitor, theme, decor[], startItem }` (sobrevive à formatura; os padrões CRT Bege 1998, Fósforo Verde e Mouse quebrado são grátis e não entram em `owned`). Leitor tolerante em `engine/lab/save.ts` (`readLabCosmetics`): ids desconhecidos somem, o que se veste precisa ser seu e do tipo certo, decorações únicas e limitadas a 4.

| Tipo | Faixa de preço | Itens |
| --- | --- | --- |
| Skins do monitor (CSS) | 1e33..1e42 | CRT Bege (grátis), Gamer RGB 1 Dc, Ultrawide Curvo 1 Td, Tela Azul 1 Dd, Tubo Adesivado 1 Td* |
| Temas (variáveis CSS) | 1e34..1e40 | Fósforo Verde (grátis), Tela Azul 10 Dc, Madrugada 1 Ud(…), Masmorra 10 Dd, Grimório (conquista) |
| Decoração (até 4) | 1e27..1e33 | 12 objetos; Gato dormindo e Troféu de hackathon são só por conquista |
| Item inicial | 1e36..1e45 | ver abaixo; Mousepad gamer RGB é só por conquista |

(Valores exatos: `DECOR_PRICE`, `MONITOR_PRICE`, `THEME_PRICE` e `START_PRICE` no arquivo.) O item inicial é uma base de ferramenta (poder igual ao do Mouse quebrado, sem afixos, não cai) com `effects` pequenos: Mouse dourado +10% Commits, Mouse com fita +10 integridade, Mouse de bolinha +5 sorte, Trackball +6% dano automático, Teclado de membrana +1 s no 1º chefão, Mousepad gamer RGB +10% dano do clique (efeito novo `clickDamage`). `startLabRun` usa `labStarterId` (o equipado, se for seu). O simulador de ritmo com cada item mantém chefão 5 em 35 a 55% e chefão 10 abaixo de 3% (`cosmetics.test.ts`).

Ações: `buyLabCosmetic(id)`, `equipLabCosmetic(id, on)` (decoração: `on = false` tira). **Para conquistas:** `grantLabCosmetic(state, content, id, emit?)` (em `engine/lab/cosmetics.ts`, exportada de `engine/actions`): dá o cosmético sem cobrar, idempotente, emite `labCosmeticGained { how: 'grant' }`. Na aba Cosméticos o que ainda não é seu aparece como "???" (só mostra como liberar: Loja com preço, ou Conquista).

## Perfil público do Laboratório

`GET /api/lab/profile?nickname=` (`server/community/labProfile.ts`): lê a coluna `players.lab_profile` (jsonb, migração `0010_lab_profile`), derivada do save na projeção (`engine/lab/profile.ts`: cosméticos vestidos e números da vida do laboratório), mais as builds dos dois recordes. Passa pelo conteúdo na leitura (ids desconhecidos voltam ao padrão), mesmas regras de exclusão dos rankings (sinalizado, banido, conta de teste, sem apelido) e 404 para quem nunca liberou o laboratório. A interface (`ui/game/lab/LabProfile.tsx`) abre pelo clique no Ranking do Laboratório; o cartão da Turma fica no link "Ver perfil na Turma".

## Conquistas e recompensas

36 conquistas novas (famílias `laboratorio` 14, `comunidade` 7 e `posdoc` 13, mais 2 secretas do lab na família `secret`). As 18 skins e os 6 cenários da coleção entraram nas listas principais (113 skins, 48 cenários), cada um recompensa de **uma** conquista. Os cosméticos só de conquista (Gato dormindo, Troféu de hackathon, Mousepad gamer RGB, tema Grimório) saem de `reward.labCosmetic` (`grantLabCosmetic`); a aba Cosméticos mostra "Conquista: <nome>", ou "Conquista secreta: ???". Quatro temas novos do jogo: Mármore do Campus, Ouro do Doutorado, Céu Estrelado e BSOD. As conquistas de raridade (Colecionador de Lendárias, Panteão...) ignoram as skins com `source`.

Condições novas: `donated`, `flag` (um fato anotado em `state.secrets`: a doação de tudo de uma vez, o chefão do lab por id, Minimalista, Mouse de Estimação, Sem as Mãos; os nomes ficam em `content/labFlags.ts`), `labStat`, `labEquipped`, `labSet` e `labTree`. A corrida guarda `run.clicks` (cliques no monitor naquela corrida).
