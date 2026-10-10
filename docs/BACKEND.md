# ADSClicker — backend

Contas, save na nuvem, ranking e comunidade. Este documento é o contrato: o que cada peça faz, como se protege e o que o cliente pode esperar. Os formatos exatos de cada requisição e resposta estão em [`src/shared/api.ts`](../src/shared/api.ts) (schemas Zod usados pelos dois lados).

## Princípios

1. **O jogo nunca espera o servidor.** A partida roda inteira no navegador, com o save local como fonte da verdade do que está na tela. A nuvem acompanha em segundo plano; se o servidor cair, o jogador não percebe nada além de um aviso discreto.
2. **Sem backend configurado, tudo continua funcionando.** Sem `DATABASE_URL`, toda rota responde `503 unavailable` e o jogo segue offline. Nenhum `build` ou página pode quebrar por falta de banco.
3. **O servidor não confia no cliente.** Tudo o que chega é validado; o que vai para o ranking passa por um teste de plausibilidade.
4. **Entrar não pode dar trabalho.** Ninguém cria conta para jogar.

## Stack

| Peça | Escolha | Motivo |
| --- | --- | --- |
| API | Route handlers do Next.js (`src/app/api/**`) | Mesmo deploy do jogo, sem servidor à parte |
| Banco | PostgreSQL 17 | Ranking é `ORDER BY` com índice; totais são `SUM`; nada exige outro tipo de banco |
| Acesso | Drizzle ORM + driver `postgres` | Tipado, leve, SQL parametrizado, migrações versionadas |
| Validação | Zod | Um schema só para cliente e servidor |
| Local | `docker compose up -d` (porta 5439) | Banco idêntico ao de produção |
| Produção | Postgres gerenciado com pooler (Neon, Supabase ou Vercel Postgres) | Funções serverless abrem muitas conexões curtas |

Sem Redis e sem WebSocket: "quem está online" sai do próprio sync (batimento a cada 45 s), e as leituras públicas são cacheadas.

## Organização do código

```
src/shared/api.ts          contrato (schemas e tipos) — dos dois lados
src/shared/apiClient.ts    chamadas tipadas para o navegador (nunca lançam exceção)
src/server/                tudo que só roda no servidor (nunca importado por componente cliente)
  db/                      schema Drizzle, conexão, migrações
  auth/                    sessões, senha, limite de tentativas
  players/                 sync, plausibilidade, projeções de ranking, feed
  community/               ranking, totais, feed (com cache)
  admin/                   jogadores, multiplicadores
  http/                    helpers de rota: erro, validação, origem, limite de taxa
src/app/api/**/route.ts    rotas finas: validam, chamam src/server, respondem
src/game/cloud/            cliente da nuvem (store `useCloud`): sync em segundo plano, conflito, conta
src/ui/game/...            telas: aba Comunidade, seção Conta, diálogo de conflito
drizzle/                   migrações SQL geradas
```

`src/server/**` pode importar `@/game/engine` e `@/game/content` (são TypeScript puro) para ler e validar saves. O contrário é proibido.

## Identidade e autenticação

- **Convidado automático.** No primeiro sync sem sessão, o servidor cria um jogador convidado e devolve um cookie de sessão. O jogador não vê formulário nenhum.
- **Conta = apelido + senha.** Criar a conta é escolher um apelido (3 a 16 caracteres, único sem diferenciar maiúsculas) **e** uma senha (6 a 72 caracteres) no mesmo passo: `POST /api/account/nickname` recebe `{ nickname, password }`, e a senha é obrigatória. Apelido e hash da senha são gravados na mesma transação, então não existe apelido novo sem senha. O campo de confirmação da senha é conferido só pelo cliente. Com a conta criada o jogador entra no ranking e no feed e, em outro aparelho, entra com apelido + senha. Sem e-mail, sem rede social.
- **Trocar o apelido** de uma conta que já tem senha também exige essa senha no corpo (`wrong_credentials` se não conferir); a senha não muda.
- **Contas antigas** (apelido sem senha, de antes da obrigatoriedade) continuam funcionando e no ranking. O cliente mostra um aviso dispensável na seção Conta convidando a criar a senha (`POST /api/account/password`, sem senha atual). Nada bloqueia o jogo.
- **Sessão.** Token aleatório de 256 bits em cookie `adsclicker_session` (`HttpOnly`, `SameSite=Lax`, `Secure` em produção, 1 ano, renovado a cada uso). O banco guarda só o SHA-256 do token.
- **Senha.** `scrypt` (do `node:crypto`) com sal por conta; comparação em tempo constante.
- **Sair.** Encerra a sessão. O save local fica no aparelho e vira um convidado novo no próximo sync.

## Sync (`POST /api/sync`)

O cliente envia o save serializado e a revisão da nuvem que ele conhece (`baseRev`).

1. Sem sessão: cria o convidado (limitado por IP) e segue.
2. Valida o corpo (Zod), o tamanho (até 64 mil caracteres) e o save em si, com `deserializeState` do motor, que descarta ids desconhecidos e limita valores. Save ilegível: `400 invalid`.
3. **Conflito.** Se a revisão no banco é maior que `baseRev` (outro aparelho salvou) e `force` não veio, responde `conflict` com o save da nuvem e não grava nada. O cliente pergunta ao jogador qual manter.
4. Aplica o multiplicador do servidor ao estado antes de calcular qualquer coisa (o valor que o cliente manda em `settings.devMultiplier` é ignorado).
5. **Plausibilidade** (abaixo). Reprovado: o save é guardado, mas o jogador fica marcado (`flagged`) e fora do ranking.
6. Atualiza numa transação: save, revisão + 1, `last_seen_at`, as colunas de ranking e os eventos novos do feed.
7. Responde `ok` com a nova revisão, o multiplicador a aplicar e o `me`.

O cliente sincroniza a cada 45 s com a aba visível, logo após formatura e contratação, e ao sair da página (`keepalive`). Nunca dentro do laço do jogo.

### Plausibilidade

O jogo é calculado no navegador, então trapacear o próprio save é sempre possível. O servidor não tenta impedir isso; ele impede que o save trapaceado apareça no ranking. O teste compara o ganho com o que o próprio estado consegue produzir:

- Com um save anterior no banco: `ganho = lifetime novo − lifetime anterior` e `tempo = agora − último sync` (relógio do servidor, mais a tolerância de ganho offline do estado).
- No primeiro sync: `ganho = lifetime` e `tempo = counters.playSeconds`.
- Teto: `(coinsPerSecond × FOLGA_PRODUCAO + clickValue × CLIQUES_POR_SEGUNDO_MAX × FOLGA_CLIQUE) × tempo`, com as taxas calculadas pelo motor no estado novo. As folgas cobrem buffs, críticos, combo, invasões e sprints empilhados; são constantes nomeadas num único arquivo, com um comentário dizendo de onde saem.
- Contadores só crescem: cliques, formaturas e diplomas menores que os do save anterior reprovam.
- Mais cliques do que `CLIQUES_POR_SEGUNDO_MAX × tempo` reprova.

Reprovação marca, não apaga nem bloqueia: falso positivo custa ao jogador o ranking, não o progresso. O admin pode limpar a marca.

## Ranking e comunidade

- Quatro quadros: `coins` (ADScoins produzidos na vida), `diplomas` (diplomas ganhos), `achievements`, `clicks`. Top 100 de cada.
- Entra no ranking quem tem apelido e não está `flagged`, `banned` nem é conta de teste.
- Quem está `flagged` (suspeito) fica fora do ranking, do feed e dos totais automaticamente; a marca e o motivo continuam guardados e visíveis no admin, que pode limpá-la. Na fase de teste os suspeitos apareciam; `RANK_FLAGGED_PLAYERS=true` no ambiente traz esse comportamento de volta.
- ADScoins passam de 10^300, então o banco guarda três colunas: o texto exato, um `numeric` para somar e o `log10` em `double precision` para ordenar com índice.
- `GET /api/community`: online agora (último sync há menos de 2 min), total de jogadores, ADScoins da comunidade, turmas formadas, cliques, conquistas, multiplicador do evento e os 30 eventos mais recentes do feed.
- **Feed.** Gerado no sync, comparando o save novo com o anterior: escolheu apelido (`joined`), contratou professor (`hire`), completou o elenco (`allProfessors`), formou turma (`graduation`), ganhou skin épica ou lendária (`skin`). Só de jogadores ranqueados.
- **Cache.** Ranking e comunidade são iguais para todo mundo: cache em memória de 10 s no servidor e `Cache-Control: public, s-maxage=10, stale-while-revalidate=30`. `/api/me/ranks` é por jogador e não é cacheado.

## Multiplicadores

`multiplicador efetivo = evento global × multiplicador do jogador`. Chega ao cliente em toda resposta de sync e de `/api/me`, e o cliente o aplica em `settings.devMultiplier`.

- **Evento global** (admin): vale para todos, não afeta a justiça do ranking.
- **Multiplicador do jogador** (admin): para demonstração e teste. Qualquer valor diferente de 1 torna o jogador **conta de teste**, fora do ranking de forma permanente (o admin pode desfazer).

O ajuste antigo por `localStorage` deixa de existir.

## Admin

Protegido pelo login que já existe (`ADMIN_USER` / `ADMIN_PASSWORD`, cookie `adsclicker_admin`). As rotas `/api/admin/**` conferem a sessão de admin em toda chamada.

- Lista de jogadores com busca e paginação: apelido, online, último acesso, progresso, marcas.
- Evento global: multiplicador para todos.
- Por jogador: multiplicador, conta de teste, marcar/desmarcar, banir, remover apelido ofensivo.
- **Redefinir senha** (`POST /api/admin/players/[id]/password-reset`, sem corpo, atrás da sessão de admin e da checagem de mesma origem): para quem perdeu a senha (o jogo não tem e-mail e a senha só existe como hash scrypt). O servidor gera uma senha temporária de 12 caracteres (`randomInt`, alfabeto sem 0/O/1/l/I), grava o hash como qualquer senha, apaga **todas** as sessões do jogador e devolve `{ player, temporaryPassword }` uma única vez. A senha nunca é guardada em claro nem entra no log (`admin_password_reset` leva só o id e o apelido). Só vale para conta com apelido (visitante: `invalid`); funciona com ou sem senha anterior. O admin mostra a senha numa caixa com botão de copiar, e ela se perde ao sair ou recarregar. O jogador entra com apelido + senha temporária e a troca em `POST /api/account/password` (senha atual + nova, que já existia; as outras sessões caem).
- Títulos por jogador e em massa, e o reset de lançamento: ver "Títulos e reset de lançamento" abaixo.
- "Este navegador": o jogador da sessão atual aparece destacado, para aplicar ×10 ou ×50 em si mesmo numa demonstração.

## Camadas de segurança

| Camada | Regra |
| --- | --- |
| Entrada | Todo corpo e query passam por um schema Zod; tamanho do corpo limitado |
| Banco | Só consultas parametrizadas pelo Drizzle; nenhuma string montada à mão |
| Sessão | Cookie `HttpOnly`; token nunca guardado em claro; sessão expira e é revogável |
| Senha | `scrypt` + sal; mínimo de 6 caracteres; resposta de login igual para apelido inexistente e senha errada |
| Origem | Requisições que alteram estado exigem `Origin`/`Sec-Fetch-Site` do próprio site |
| Taxa | Limite por IP e por jogador, em tabela do Postgres (janela fixa): login 10/10 min, criação de convidado 20/h, sync 6/min, apelido 5/h |
| Ranking | Plausibilidade, contas de teste fora, marcação manual pelo admin |
| Apelido | Formato restrito, unicidade sem diferenciar maiúsculas e acentos, lista de termos bloqueados |
| Cabeçalhos | `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` em todas as respostas |
| Erros | Mensagem genérica ao cliente; detalhe só no log do servidor |
| Privacidade | Nenhum e-mail; IP usado só como chave de limite, guardado como hash com sal |

## Variáveis de ambiente

| Nome | Para quê |
| --- | --- |
| `DATABASE_URL` | Conexão do Postgres. Em produção, a URL com pooler |
| `ADMIN_USER`, `ADMIN_PASSWORD` | Login do `/admin` |
| `IP_HASH_SALT` | Sal do hash de IP dos limites de taxa |

## Rodando

```bash
docker compose up -d         # Postgres local na porta 5439
npm run db:migrate           # aplica as migrações
npm run dev
```

Produção: criar o banco gerenciado, cadastrar as variáveis na Vercel, rodar `npm run db:migrate` apontando para ele e fazer o deploy.

## Títulos e reset de lançamento

### Títulos

- Um jogador pode ter zero ou mais títulos de um catálogo fixo em código, [`src/shared/titles.ts`](../src/shared/titles.ts): `id`, nome, descrição, cor e, se for o caso, `single` (só um jogador pode tê-lo). O catálogo está em ordem de prioridade. Hoje: `primeiro-platinado` ("Primeiro Platinado", `single`) e `turma-zero` ("Turma Zero", para quem jogou a fase de testes).
- **Armazenamento:** coluna `players.titles text[]` (padrão vazio), não uma tabela à parte. O ranking e o mural já leem a linha do jogador, então os títulos vêm junto, sem join e sem consulta nova (o ranking continua com seu cache de 10 s). Ninguém consulta "quem tem o título X" com frequência a ponto de precisar de índice. Ids que saírem do catálogo são ignorados na leitura.
- **Contrato (só campos opcionais):** `titles?: string[]` em `me`, em cada linha do ranking e em cada item do mural (ids, do de maior prioridade para o de menor; ausente = nenhum). Clientes antigos ignoram o campo.
- **Interface:** selo pequeno ao lado do apelido (o de maior prioridade; os demais, com a descrição, no atributo `title`), no ranking, na linha "você está em Nº lugar" e no mural.
- **Admin, por jogador** (`POST /api/admin/players/[id]` com `grantTitle` ou `revokeTitle`): conceder e remover são idempotentes. Conceder um título `single` a um segundo jogador é recusado com o nome de quem o tem.
- **Admin, em massa** (`GET/POST /api/admin/titles/turma-zero`): "Dar Turma Zero a todos os jogadores atuais" dá o título a toda conta **com apelido e com ao menos um sync aceito** (`rev > 0`). O GET mostra a contagem (elegíveis, que já têm, que receberão) antes de confirmar. Repetir não faz nada (a segunda execução concede 0). Mantém os outros títulos de cada jogador.

### Reset de lançamento

`POST /api/admin/launch-reset` com a frase `ZERAR PROGRESSO` (o GET devolve a contagem do que seria tocado). Numa **única transação**:

| O que | Efeito |
| --- | --- |
| Save na nuvem, revisão, resumo de progresso (ADScoins, diplomas, formaturas, cliques, conquistas, professores, tempo de jogo, avatar) | voltam ao valor de quem nunca jogou, para **todas** as contas |
| Posição no ranking e totais da comunidade | somem junto (são calculados sobre essas colunas) |
| Marcas de suspeito (`flagged`, motivo) | limpas |
| Mural (`feed_events`) | esvaziado |
| Hackathon (perfis, itens, partidas, fases, coleção) | esvaziado |
| Época de progresso | sobe de 1 |
| **Mantidos** | contas, apelidos, senhas, sessões, títulos, conta de teste, multiplicador do jogador, banimento, multiplicador do evento global, contadores de limite de taxa |

Responde quantas linhas tocou em cada tabela (`players` = contas atualizadas, `playersWithProgress` = as que tinham algo a apagar). É seguro rodar duas vezes: a segunda não apaga mais nada (`playersWithProgress: 0`) e só sobe a época mais um. Cuidado: rodar de novo **depois** que os jogadores já recomeçaram apaga o progresso novo deles também.

### O que o jogador vê depois do reset (época de progresso)

O aparelho de um testador ainda guarda o save antigo. Para que ele não repovoe o ranking, existe uma **época de progresso**: um contador em `app_config` (`progress_epoch`, 0 até o primeiro reset), copiado para `players.progress_epoch` de cada conta. O aparelho guarda a época que viu (junto da revisão, em `adsclicker.cloud`) e a manda em todo `POST /api/sync` (`epoch`; ausente ou nunca aprendida = 0, a fase de testes).

- Época diferente da conta: o servidor **não grava nada** e responde `{ status: 'reset', epoch }` (também com `force`). A gravação do sync inclui a época na condição, então um reset que acontece no meio de um sync também o derruba.
- O aparelho então guarda o save antigo à parte (`localStorage`, chave `adsclicker.preResetSave`, nunca enviado), recomeça o jogo do zero, adota a época nova e mostra **uma vez** o aviso "O jogo foi zerado para o lançamento". Apelido, senha e títulos continuam (a sessão não muda). Um aparelho sem progresso real (até 60 s de jogo) recomeça em silêncio, sem aviso.
- Um aparelho novo, que nunca sincronizou e sem progresso, apenas entra na época atual (vem em `GET /api/me`). Um convidado criado depois do reset já nasce na época atual.
- Entrar com a conta num aparelho sem save traz a conta zerada (sem save na nuvem). Num aparelho com save antigo, o primeiro sync dispara o fluxo acima.
- Páginas abertas com o código antigo (sem `epoch`) continuam jogando só no navegador: o servidor recusa o sync com `reset`, que o código antigo trata como falha. Ao recarregar, o código novo assume. O save antigo nunca chega ao ranking.
- O save de antes só fica guardado no aparelho; não há tela para restaurá-lo (hoje só pelo console do navegador).

### Passo a passo no dia do lançamento

1. **Backup do banco de produção** (snapshot do provedor ou `pg_dump`). O reset não tem volta.
2. **Aplicar as migrações em produção, antes do deploy.** A produção ainda não tem a migração do Hackathon (`drizzle/0001_whole_wasp.sql`), e há a nova, dos títulos e da época (`drizzle/0002_mushy_grandmaster.sql`, duas colunas em `players`, ambas aditivas). Com `DATABASE_URL` apontando para a produção (URL com pooler): `npm run db:migrate`. O comando aplica `0001` e `0002` em ordem e é seguro repetir. O código antigo continua funcionando com as colunas novas.
3. **Deploy** do código desta versão. Confira `GET /api/me`: a resposta traz `"epoch": 0`.
4. Entrar em `/admin`. Conferir que o **evento global** está em "Sem evento" (o reset não mexe nele).
5. Card **Lançamento**, "Dar Turma Zero a todos os jogadores atuais": ler a contagem, confirmar. **Isto vem antes do reset**: depois dele ninguém tem sync aceito e o botão não encontraria mais ninguém.
6. **Primeiro Platinado:** na lista de jogadores, buscar pelo apelido, Gerenciar, "Dar Primeiro Platinado". Só um jogador pode tê-lo.
7. Conferir na aba Turma do jogo que os selos aparecem.
8. Card **Lançamento**, "Zerar progresso para o lançamento": ler a contagem e o aviso (se ainda houver elegíveis sem Turma Zero, volte ao passo 5), digitar `ZERAR PROGRESSO`, "Zerar agora". Anotar o relatório.
9. Conferir: ranking vazio (ou só com zeros), `GET /api/me` com `"epoch": 1`, e abrir o jogo num aparelho de testador (aviso de reset, jogo do zero, selo ainda ao lado do apelido).
10. Abrir o jogo ao público. **Não rodar o reset de novo** depois disso.

## Logs

O `/admin` tem o card **Logs** com duas visões: **Servidor** e **Atividades**. Ambas ficam atrás da sessão de admin (`GET /api/admin/logs` e `GET /api/admin/activity`), mostram a última hora por padrão (atalhos 1 h, 24 h, 7 dias, tudo), do mais novo para o mais antigo, com "Carregar mais", filtro e busca, e horários no fuso do navegador.

### Servidor (`server_logs`)

Tabela `server_logs` (`id`, `at`, `level` info/warn/error, `kind`, `message`, `player_id`, `nickname`, `route`, `detail` jsonb) sem chave estrangeira: o registro sobrevive à conta. Migração `drizzle/0003_thick_calypso.sql` (aditiva; o `vercel-build` aplica sozinho). Escrita por `logEvent` (`src/server/logs/log.ts`):

| O que | `kind` (nível) | De onde |
| --- | --- | --- |
| Erro inesperado (500), com rota, mensagem curta e 3 linhas da pilha | `server_error` (error) | `route()` em `server/http/route.ts` |
| Limite de taxa recusado (qual limite, qual rota; no máximo 1 por minuto por limite e rota) | `rate_limited` (warn) | `route()` |
| Banco inacessível | `db_unreachable` (error) | `route()` guarda na memória; a próxima escrita que der certo grava uma linha com desde/até e quantas requisições falharam. O `console.error` de antes continua |
| Save recusado como inválido | `sync_invalid_save` (warn) | `syncPlayer` |
| Sync que marca suspeito, com o motivo da plausibilidade | `sync_suspect` (warn) | `syncPlayer` |
| Convidado criado | `guest_created` (info) | `createGuest` |
| Apelido escolhido / senha definida ou trocada | `nickname_claimed`, `password_set` (info) | `players/account.ts` |
| Login ok / falho (apelido tentado e motivo, nunca a senha) | `login_ok` (info), `login_failed` (warn) | `auth/login.ts` |
| Login do admin ok / falho (sem usuário nem senha) | `admin_login`, `admin_login_failed` | `app/admin/actions.ts` |
| Banir, marcar, tirar a marca, multiplicador, conta de teste, apelido removido, título dado/tirado | `admin_ban`, `admin_unban`, `admin_flag`, `admin_unflag`, `admin_multiplier`, `admin_test_account`, `admin_clear_nickname`, `admin_title_grant`, `admin_title_revoke` | `patchPlayer` |
| Senha redefinida pelo admin (sem a senha) | `admin_password_reset` | `resetPlayerPassword` |
| Multiplicador do evento, Turma Zero em massa, reset de lançamento (com as contagens) | `admin_event_multiplier`, `admin_turma_zero`, `admin_launch_reset` | rota do evento, `grantTurmaZeroToAll`, `resetForLaunch` |

A marca de suspeito só é limpa pelo admin (`admin_unflag`) ou pelo reset de lançamento; o sync nunca a limpa.

**Fora do caminho da requisição.** A escrita é agendada com `after()` do Next (depois da resposta); fora de uma requisição ela dispara sem ser esperada. Todo erro dela é engolido: logar nunca derruba nem atrasa nada. Os testes desligam `logEvent` (`NODE_ENV=test`); `writeLog` é testado direto.

**O que nunca entra.** `detail` passa por `redact`: chaves com `pass`, `senha`, `token`, `cookie`, `secret`, `hash`, `ip`, `save` etc. viram `[removido]`; textos são cortados em 300 caracteres, no máximo 20 itens por lista, 3 níveis e 4 000 caracteres no total. Nenhum IP, senha, cookie ou save inteiro é gravado.

**Tráfego.** Sync aceito não vira linha. `traffic_hourly` guarda uma linha por hora (aceitos, recusados) e `traffic_hourly_players` uma por jogador por hora (para contar jogadores distintos); o card mostra as últimas 24 h no topo. "Recusado" = save inválido ou limite de taxa; conflito e reset de época não contam como nenhum dos dois.

**Retenção.** 30 dias ou 100 000 linhas, o que vier primeiro (constantes em `src/shared/api.ts`). A poda roda ao abrir o card (primeira página) e, no máximo a cada 10 minutos por instância, depois de uma escrita. Vale também para as tabelas de tráfego (30 dias). A tela diz isso.

### Atividades (`feed_events`)

Todas as linhas da tabela do mural (o jogo mostra só as 30 mais recentes), com apelido, o texto igual ao do mural público (`feedAction`) e a hora; filtro por tipo e busca por apelido. O mural público e o cache de 10 s não mudaram. A retenção do mural era de 14 dias e sem limite de linhas; agora é a mesma dos logs (30 dias, 100 000 linhas), podada na carga da comunidade (no máximo de hora em hora por instância) e ao abrir a visão. O reset de lançamento apaga este histórico, e a tela avisa.
