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
- **Apelido.** Escolher um apelido (3 a 16 caracteres, único sem diferenciar maiúsculas) coloca o jogador no ranking e no feed.
- **Senha opcional.** Definir uma senha torna a conta utilizável em outro aparelho: lá o jogador entra com apelido + senha. Sem e-mail, sem confirmação, sem rede social.
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
- **Fase de teste:** por enquanto quem está `flagged` (suspeito) também aparece no ranking, no feed e nos totais; a marca e o motivo continuam guardados e visíveis no admin. Para voltar à regra rígida, defina `RANK_FLAGGED_PLAYERS=false` no ambiente ou troque o padrão em `src/server/players/ranking.ts`.
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
