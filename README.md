# ADSClicker

Jogo clicker e idle em pixel art sobre os professores do curso de Análise e Desenvolvimento de Sistemas. Remaster do [Edécio Clicker](https://github.com/joaopedro-ssilva/edecioclicker), de 2023.

Se você gostou do jogo, deixe uma estrela no repositório. Ajuda bastante.

## Rodando

```bash
npm install
npm run dev        # http://localhost:3000
```

O jogo funciona sem backend e salva no navegador. Contas, save na nuvem e ranking precisam de um Postgres:

```bash
cp .env.example .env.local   # defina ADMIN_USER, ADMIN_PASSWORD e IP_HASH_SALT
npm run db:up                # Postgres no Docker, porta 5439
npm run db:migrate
```

## Feito com

Next.js, React, TypeScript, Zustand, Drizzle e Postgres.

## Documentação

- [Design do jogo](docs/GAME_DESIGN.md)
- [Arquitetura](docs/ARCHITECTURE.md)
- [Backend](docs/BACKEND.md)

## Créditos

Criado por [João Pedro](https://github.com/joaopedro-ssilva).
