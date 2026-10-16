# ADSClicker — Laboratório de Pesquisa (motor e store)

Mini-jogo roguelike alcançado pela sala de aula. Reaproveita o conteúdo do modo Hackathon (que continua desligado): as 24 bases de item, as raridades, os inimigos, os buffs de onda e o conjunto Kit Plantão. Este arquivo descreve o **motor e a store**; a interface vem depois. Todos os números ficam em um lugar só: `src/game/content/lab.ts` (tipos em `src/game/content/labTypes.ts`). O motor está em `src/game/engine/lab/`.

## Decisões do dono

- **Liberação:** depois de contratar o Pablo aparece um 9º "professor", o Laboratório. Desbloquear custa **100 diplomas, uma vez** (`lab.unlocked`, permanente). O bônus de produção usa `diplomasEarned`, então nada se perde.
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
  bestPhase,                      // fase mais alta alcançada (quebrar na 7 conta 7)
  counters: { runs, broken, phasesCleared, bossesBeaten, itemsFound, itemsRecycled,
              itemLevelUps, affixRerolls, clicks, commitsEarned },
  turma: {                        // zerada na formatura
    run: null | {
      seed, status: 'fighting'|'reward'|'equip'|'broken',
      phase, t, phaseTime, carry,
      integrity, maxIntegrity,
      mobs[], mobSeq, waveHp, bossLeft, nextCharge,
      offers[], pending,          // recompensa em tela / item esperando decisão
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
| HP | HP do Hackathon x 0,1 x 1,18^(fase-1). Chefão: x 0,4 |
| Dreno | dano x ataques/s do inimigo x 0,05 x 1,12^(fase-1) por segundo, com `ramp` (vazamento, chefão) e carga do chefão (golpe a cada 9 s). `armor` vira redução de dano (8% por ponto, máx. 50%); `split` do Conflito de merge vale |
| Chefão | toda 5ª fase, **30 s** de prazo (+ árvore). Prazo zerado ou integridade 0 = monitor quebra |
| Segundo fôlego | uma vez por fase (por carga), a queda fatal deixa 15% da integridade |

Ordem de um passo: dano, fase vencida?, dreno, golpe do chefão, integridade, prazo.

### Recompensas

Ao vencer uma fase: **3 opções** (4 na primeira com a árvore; +1 pela chance de "opção extra" dos itens, até 5). A primeira é sempre item; as demais sorteiam por peso item 3, buff 3, Commits 1,5, reparo 1,5 (reparo x2,5 com o monitor abaixo de 50%). Chefão: duas opções de item, a primeira **raro ou melhor** e a segunda **incomum ou melhor**.

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
- **Árvore permanente** (`lab.tree`, 12 nós, 3 ramos, comprados com Commits, `custo x crescimento^nível`):
  - Código: Algoritmos eficientes (+10% dano, 10 níveis), Estudo de chefão (+10% dano em chefões, 5), Setup de casa (começa com item comum no Setup).
  - Infra: Monitor reforçado (+10 integridade, 10), Backup noturno (+5% de reparo após chefão, 5), Prazo folgado (+5 s no chefão, 4), Rede segura (-4% dreno, 5), Nobreak do laboratório (segundo fôlego).
  - Produto: Revisão de PR (4 opções na primeira recompensa), Código limpo (+5 sorte, 6), Documentação (+10% nos buffs do clicker, 5), Portfólio (+20% Commits, 3).
  Total da árvore: cerca de 2.200 Commits.

## Pontos de integração

- `engine/stats.ts`: `computeStats` soma `labClickerEffects` depois dos buffs ativos.
- `engine/tick.ts`: `advance` chama `advanceLab` com o tempo real do tick.
- `engine/prestige.ts`: `graduate` chama `resetLabForGraduation`.
- `engine/save.ts`: `readLab` + `settleLabAfterLoad`; `engine/init.ts`: `createLabState`.
- Eventos (`store/types.ts`): `labUnlocked`, `labRunStarted`, `labPhaseCleared`, `labBossBeaten`, `labBroken`, `labItemGained`, `labItemRecycled`, `labItemChanged`, `labNodeBought`. A interface trata `labUnlocked`, `labBossBeaten` e `labBroken` em `handleGameEvent.ts`.
- Store (`GameActions`): `unlockLab`, `setLabOpen`, `startLabRun`, `labClick`, `chooseLabReward`, `equipLabPending`, `recycleLabPending`, `levelUpLabItem`, `rerollLabAffix`, `buyLabNode`.
- Views (`engine/lab/views.ts`, hooks em `store/labHooks.ts`): `labSlotView` (o 9º slot), `labMonitorView`, `labBenchView`, `labRewardsView`, `labTreeView`.

## Servidor

O servidor lê o save com o mesmo `deserializeState` e julga com `computeStats`, então os buffs do laboratório entram na conta de verossimilhança sozinhos. Medido com o simulador (`plausibility.lab.test.ts`): o pior caso de uma compra honesta com 4 lendários nível 20, árvore cheia e todos os buffs empilhados usa cerca de 14% do teto de moedas, igual a jogar sem laboratório. O que um save forjado ganha é limitado pelos tetos acima e pelo leitor (valores presos ao que a raridade rola, nível 20). O ranking de `bestPhase`, quando existir, deve revalidar a corrida pela semente e pelo `clearLog`.

## Balanceamento

Um jogador simulado (`pacing` em `lab.test.ts`) que escolhe o melhor item, buff de dano e reparo quando machucado, sem gastar ADScoins: sem árvore chega à fase 14 (mediana; p10 12, p90 17) em cerca de 2 min e meio de luta; com a árvore média, 20; com a cheia, 27 (p90 32).
