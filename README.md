<div align="center">

# ADSClicker

**Um clicker em pixel art sobre os professores do curso de Análise e Desenvolvimento de Sistemas.**

![Os oito professores do ADSClicker na sala de aula](docs/readme/banner.png)

Clique, contrate o corpo docente, forme turmas e colecione skins.

### [▶ Jogar agora](https://adsclicker.biigstudio.com.br/)

<sub>Endereço provisório.</sub>

⭐ **Gostou do jogo? Deixe uma estrela no repositório.** ⭐

</div>

## O jogo

Você começa com o Edécio e um café. Cada clique rende ADScoins, cada aula rende sozinha, e cada professor contratado traz uma mecânica própria: combo, ganho offline, invasões para defender, habilidades, sprints e formatura. Formar a turma zera a sala e rende diplomas, que deixam a próxima mais forte.

## Para colecionar

| | |
| --- | --- |
| 🎭 **86 skins** | Das comuns às míticas, uma mítica para cada professor |
| 🏞️ **35 cenários** | Da sala de aula à galáxia, passando pelo cofre de ADScoins |
| 🎨 **12 temas** | Cores diferentes para a interface |
| 🏆 **129 conquistas** | Algumas secretas |

Tudo é liberado jogando. Não há compras.

## Também tem

- Oito professores, cada um com sua **Maestria**, uma mecânica especial que você escolhe a cada formatura.
- **Monitores** que automatizam compras, pesquisas, invasões e sprints.
- Save na nuvem, ranking e estatísticas da turma.

## Créditos

Criado por [João Pedro](https://github.com/joaopedro-ssilva). Remaster do [Edécio Clicker](https://github.com/joaopedro-ssilva/edecioclicker), de 2023.

---

## Para desenvolvedores

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

Feito com Next.js, React, TypeScript, Zustand, Drizzle e Postgres.

Documentação: [design do jogo](docs/GAME_DESIGN.md), [arquitetura](docs/ARCHITECTURE.md) e [backend](docs/BACKEND.md).
