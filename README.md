# ADSClicker

Clicker + idle em pixel art sobre o corpo docente do curso de ADS. Remaster do [Edécio Clicker](https://github.com/joaopedro-ssilva/edecioclicker) (2023).

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # testes do motor e do conteúdo
npm run typecheck
npm run lint
npm run sim        # simulador de balanceamento
```

- Design do jogo: [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md)
- Arquitetura e regras do código: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Backend (contas, save na nuvem, ranking, comunidade, admin): [docs/BACKEND.md](docs/BACKEND.md)

## Backend local

O jogo funciona sem backend (salva só no navegador). Para ligar a parte online:

```bash
cp .env.example .env.local   # defina ADMIN_USER, ADMIN_PASSWORD e IP_HASH_SALT
npm run db:up                # Postgres no Docker, porta 5439
npm run db:migrate           # cria as tabelas
npm run dev
```

Em produção: crie um Postgres gerenciado (Neon, Supabase ou Vercel Postgres), cadastre `DATABASE_URL` (URL com pooler), `ADMIN_USER`, `ADMIN_PASSWORD` e `IP_HASH_SALT` na Vercel e rode `DATABASE_URL=<url> npm run db:migrate` uma vez.
