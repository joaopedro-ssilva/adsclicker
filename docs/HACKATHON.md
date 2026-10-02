# ADSClicker — modo Hackathon (primeira versão)

Modo ativo e permanente: o jogador cria um aluno, luta contra bugs em combate automático, coleta itens com raridade e sobe de cargo. Nada do Hackathon zera na formatura. Este arquivo é o contrato da primeira versão; os tipos estão em `src/hackathon/content/types.ts`, `src/hackathon/engine/types.ts` e `src/shared/hackathonApi.ts`.

## Decisões do dono

- Nomes: modo **Hackathon**, moeda **Commits**, energia **Café**.
- **Só online.** Itens, nível, cargo e Commits vivem no banco. Sem backend, o modo aparece como indisponível e a sala de aula segue normal.
- Criação do aluno: escolher 1 entre 12 cabeças prontas. O corpo vem do cargo. O nome é o apelido da conta.
- **A moeda não compra itens.** Commits compram níveis de mentor e utilidades (rerrolar atributo, redistribuir a árvore). Item só vem de drop. Sem vitrine.
- Acesso: botão de modo no topo do palco (Sala de aula ⇄ Hackathon), liberado quando o terceiro professor (Bruna B2) é contratado pela primeira vez.
- Café: até 5, +1 a cada 15 minutos, comprável com ADScoins na sala de aula.
- Habilidades têm modo automático com 20% menos efeito.
- Fora da primeira versão: item da semana, troca entre jogadores, tipos de dano, Maratona, montador de aparência por peças, cargos acima de Estagiário.

## Recorte da primeira versão

| Parte | Quantidade |
| --- | --- |
| Cargos | Estudante (nível 1 a 10) e Estagiário (11 a 20) |
| Campanha | Capítulo 1: 8 fases e 1 chefão de promoção |
| Fase aleatória | Hackathon do dia: 1 fase gerada pela data, igual para todos |
| Inimigos | 4 comuns e 1 chefão |
| Itens | 24 bases (6 por espaço), 1 conjunto de 4, raridades de comum a lendário |
| Habilidades | Árvore com 12 nós em 3 ramos, 4 habilidades ativas |
| Mentores | Os 8 professores, níveis 0 a 5 |
| Melhorias entre ondas | 12 |

## Como os modos se ligam

| Sentido | O quê | Mecanismo |
| --- | --- | --- |
| Sala → Hackathon | Café | Ação `buyCafe` no jogo: custa 10 minutos da produção atual e soma 1 em `counters.cafesBought`. No sync, o servidor credita a diferença, até 12 por dia |
| Sala → Hackathon | Formatura | No sync, cada aumento de `counters.graduations` enche o Café e dá XP (`graduationXp`), até 3 por dia |
| Sala → Hackathon | Mentores | Um mentor existe para cada professor que o save da nuvem mostra contratado ou já contratado (conquista `hire-<id>`). Edécio sempre |
| Hackathon → Sala | Mentor | Cada nível soma 10% à produção daquele professor |
| Hackathon → Sala | Cargo | Estagiário: ADScoins ×1,25 |

Os dois bônus chegam ao jogo no campo `bonus` das respostas de `/api/sync` e `/api/me` e são aplicados com a ação `setCloudBonus` do store (campo `GameState.cloudBonus`). O servidor ignora o `cloudBonus` que o cliente manda e usa o dele no teste de plausibilidade.

Fica para depois: o ramo "Hackathon" na árvore de diplomas, skins de aluno e cenários como recompensa.

## Combate

Simulação determinística em passos de 100 ms (`TICK_MS`). Mesma semente, mesmo build e mesmas ações dão sempre o mesmo resultado, no navegador e no servidor. Sem `Math.random`, sem relógio, sem funções transcendentes (`pow`, `exp`, `sin`...) dentro da simulação: só soma, multiplicação, divisão, `floor` e um gerador de números com semente.

- **Atributos**: Lógica (dano), Agilidade (golpes por segundo), Foco (vida), Resiliência (reduz dano: `dano × 100 / (100 + resiliência)`), Atenção (chance de crítico; o crítico vale ×2), Sorte (loot, não entra na luta).
- **Build** = atributos base do cargo e do nível + itens equipados + nós da árvore + mentores. O servidor monta o build a partir do banco; o cliente nunca o envia.
- **Fase** = 3 a 5 ondas. A ordem das ondas, menos a última, é embaralhada pela semente. A vida não se recupera entre ondas.
- **Onda** = 1 a 3 inimigos. O aluno ataca sozinho o primeiro inimigo vivo; cada inimigo ataca o aluno no próprio ritmo.
- **Comportamentos de inimigo** (dados, não código por inimigo): atordoar, dano crescente, armadura, dividir-se ao morrer, cronômetro de onda, golpe anunciado (carrega 1,5 s e bate forte).
- **Ações do jogador**, todas com o passo em que aconteceram:
  - `flow`: a barra de Fluxo encheu (o cliente a enche com cliques). O próximo golpe é crítico. Só vale se o anterior foi há pelo menos 4 s.
  - `skill`: usar uma habilidade ativa equipada, respeitando a recarga. Ignorada quando o modo automático está ligado.
  - `choice`: qual das 3 melhorias sorteadas pegar depois de uma onda. Sem a ação, vale a primeira.
- Ação inválida é ignorada, não é erro: o servidor refaz a luta com as ações recebidas e o resultado dele é o que vale.
- **Modo automático**: a simulação usa cada habilidade assim que recarrega, com 80% do efeito.
- **Fim**: vitória ao limpar todas as ondas; derrota se a vida zerar ou o cronômetro de uma onda acabar.

## Protocolo de uma fase

1. `POST /api/hackathon/run/start` `{ stageId, auto }`: o servidor confere o desbloqueio, desconta 1 Café, sorteia a semente, guarda a partida com uma cópia do build e devolve `{ runId, seed, build, stage }`.
2. O cliente roda a simulação em tempo real, anotando as ações.
3. `POST /api/hackathon/run/finish` `{ runId, actions }`: o servidor refaz a luta, decide o resultado e, numa transação, grava XP, Commits, itens sorteados, níveis, promoção e progresso da fase. Uma partida só pode ser finalizada uma vez e expira em 30 minutos.
4. Derrota: 30% do XP, nenhum item, nenhum Commit.

## Loot

Sorteado no servidor com `node:crypto`, nunca pela semente da luta (o cliente não pode prever).

- Vitória dá 1 item, mais a chance de um extra (Sorte e mentor Gladimir). O chefão dá 2.
- Cada item: uma base da tabela da fase, uma raridade, e os atributos dentro das faixas da base, escalados pelo nível da fase. O item guarda a qualidade do sorteio (0 a 100).
- Raridade base: comum 60%, incomum 26%, raro 10%, épico 3,3%, lendário 0,7%. Sorte e o mentor Bruna B2 deslocam peso para cima.
- Atributos sorteados: comum 1, incomum 2, raro 2 (faixa mais alta), épico 3, lendário 3 mais o efeito único da base.
- Garantia: 40 vitórias seguidas sem lendário tornam o próximo item lendário.
- Primeira vitória em cada fase: um item garantido no mínimo incomum e Commits em dobro.
- Reciclar um item devolve Commits conforme a raridade. Rerrolar troca um atributo por outro sorteio, pagando Commits (o custo dobra a cada rerrolagem do mesmo item).
- Inventário: 40 itens. Cheio, o drop vira Commits automaticamente.
- Todo lendário vira evento no feed da comunidade (`item`), e o melhor item do jogador aparece no ranking.

## Dados no banco

Tabelas novas, todas com `player_id`: perfil (cabeça, cargo, nível, XP, Commits, Café e quando foi contado, árvore, mentores, itens equipados, contador da garantia, contadores da sala já creditados), itens, partidas, progresso por fase, coleção (bases já encontradas). Migração gerada com `npm run db:generate`.

## Organização do código

```
src/hackathon/content/   dados do modo (types.ts é o contrato)
src/hackathon/engine/    simulação, build, loot e progressão: TypeScript puro, sem React, sem banco
src/hackathon/sim/       simulador de balanceamento
src/shared/hackathonApi.ts   schemas das rotas
src/server/hackathon/    perfil, partidas, loot, mentores, ligação com o sync
src/app/api/hackathon/   rotas finas
src/ui/hackathon/        store do cliente, arena, telas do painel
public/assets/hackathon/ arte
```

`engine` roda igual no navegador e no servidor. `src/server/hackathon` pode importar `engine` e `content`; o contrário é proibido. As regras de `docs/ARCHITECTURE.md` e `docs/BACKEND.md` valem aqui.
