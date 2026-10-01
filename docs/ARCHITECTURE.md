# ADSClicker — arquitetura

Remaster do Edécio Clicker (v1.3, 2023). Clicker + idle em pixel art sobre o corpo docente do curso de ADS.
O design do jogo está em [GAME_DESIGN.md](GAME_DESIGN.md). Este arquivo diz onde cada coisa mora e quais regras o código segue.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript estrito · Tailwind 4 · Zustand 5 · break_infinity.js · Motion · Vitest · Playwright.

O jogo roda inteiro no cliente. O Next está aqui para o backend futuro (social, ranking, save na nuvem); hoje não há rota de API.

## Regra central

**Regra de jogo não conhece tela, e tela não conhece regra.**

```
src/
  game/
    content/   dados: professores, upgrades, conquistas, skins... (types.ts é o contrato)
    engine/    regras puras em TypeScript. Não importa React, DOM, window nem Zustand.
    store/     Zustand: guarda o GameState, roda o laço, expõe ações e o barramento de eventos
    sim/       simulador de balanceamento (roda o engine sem interface)
  ui/          componentes React, animações, áudio. Lê view models, chama ações.
  app/         rotas do Next (layout, página do jogo, /kit)
public/assets/ sprites e cenários processados (opcionais: a UI tem fallback procedural)
scripts/art/   pipeline de imagens
docs/
```

Dependências permitidas: `content` ← `engine` ← `store` ← `ui`. Nunca ao contrário.
`ui` pode importar tipos e dados de `content` e funções de view de `engine/views`, mas só muda estado pelas ações do store.

## Contratos (não quebre)

| Arquivo | O que define | Dono |
| --- | --- | --- |
| `src/game/content/types.ts` | Formato de todo o conteúdo e o `BalanceConfig` | arquiteto (congelado) |
| `src/game/engine/state.ts` | `GameState`, o save inteiro | engine (só mudanças aditivas) |
| `src/game/store/types.ts` | `GameActions`, `GameEvent`, view models | engine (só mudanças aditivas) |

Se um contrato congelado precisar mudar, não mude: anote o pedido no seu relatório final.

## Engine

- Funções recebem `(state, content, ...args, emit?)` e **mutam o `state` no lugar**. Sem singletons, sem `Date.now()` escondido: o tempo entra como parâmetro `now`.
- Aleatoriedade entra por um `rng: () => number` injetado (padrão `Math.random` no store), para os testes serem determinísticos.
- Todo valor que cresce sem limite é `Decimal` (break_infinity.js). `number` só para níveis, contadores e tempo.
- Tudo o que o conteúdo altera passa por `Effect { stat, op, value }`. `computeStats(state, content)` soma os `add`, multiplica os `mult` e devolve os valores finais. Fontes de efeito: pesquisas compradas, nós de prestígio (× nível), buffs ativos. Nada de `if (id === 'guto')` no engine.
- `GameEvent` (barramento) avisa a UI do que aconteceu, para animação e som. Nunca é usado para carregar estado.

## Store

- Um único store Zustand: `useGame`. `state` é o `GameState`; depois de cada mutação o store publica uma nova referência de topo (`{ ...state }`) para os seletores reagirem.
- O laço roda com `setInterval` de 100 ms e avança pelo tempo real decorrido (`now - lastTickAt`), então aba em segundo plano e computador lento não perdem produção.
- Save em `localStorage` (`adsclicker.save`), JSON versionado com migrações. Autosave a cada 15 s, após compras (com debounce) e no `beforeunload`.
- Nada de `window`/`localStorage` em tempo de import: o Next renderiza no servidor. O jogo só monta depois de `boot()` (`ready === true`).

## UI

- Componentes em `src/ui`. Um componente por arquivo, nome em PascalCase, sem lógica de jogo: recebe view models e chama ações.
- Tokens de design em variáveis CSS (`src/app/globals.css`). A cor de destaque vem do professor em sala (`--accent`); o tema da B2 troca só as cores base.
- Pixel art: toda imagem de sprite usa `image-rendering: pixelated` e escala inteira.
- Arte é opcional. `src/ui/art/manifest.ts` lista os arquivos que existem em `public/assets`; se o sprite não existe, o componente desenha a versão procedural a partir da `palette` do conteúdo.
- Animação: Motion para interface, canvas para partículas e números flutuantes. Respeite `prefers-reduced-motion` e a opção do jogo.
- Texto do jogo em português do Brasil. Código, nomes e comentários em inglês.

## Qualidade

- `npm run typecheck`, `npm run lint` e `npm test` passam antes de qualquer entrega.
- Engine e conteúdo têm testes (Vitest). Testes de conteúdo validam ids únicos e referências existentes.
- Sem `any`, sem `// @ts-ignore`. Comentário só para o porquê não óbvio.
- Não adicione dependências sem necessidade real; se precisar, anote no relatório.
