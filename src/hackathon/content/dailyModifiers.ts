import type { DailyModifierDef } from './types';

/** Percent fields are added on top of the normal value (100 = double). */
export const dailyModifiers: DailyModifierDef[] = [
  {
    id: 'bugs-gordos',
    name: 'Bugs gordos',
    description: 'Inimigos com o dobro de vida, mas o loot vem uma faixa melhor.',
    enemyHpPercent: 100,
    lootQuality: 40,
  },
  {
    id: 'sem-cafe',
    name: 'Sem café',
    description: 'Nenhuma cura funciona hoje, mas o XP é dobrado. Sem cafeína, sem Refatorar.',
    noHealing: true,
    xpPercent: 100,
  },
  {
    id: 'segunda-feira',
    name: 'Segunda-feira',
    description: 'Inimigos batem 40% mais forte, mas o loot é 25% melhor. Ninguém está de bom humor.',
    enemyDamagePercent: 40,
    lootQuality: 25,
  },
  {
    id: 'sexta-17h59',
    name: 'Sexta às 17h59',
    description: 'Inimigos batem 80% mais forte, mas o loot é 60% melhor. Quem manda subir agora?',
    enemyDamagePercent: 80,
    lootQuality: 60,
  },
  {
    id: 'fim-de-semestre',
    name: 'Fim de semestre',
    description: 'O XP é dobrado, e o que sobra de energia vai para entregar trabalho.',
    xpPercent: 100,
  },
  {
    id: 'dia-de-sorte',
    name: 'Dia de sorte',
    description: 'Loot 80% melhor, mas os inimigos têm 30% mais vida. O trevo cobra juros.',
    lootQuality: 80,
    enemyHpPercent: 30,
  },
  {
    id: 'dia-tranquilo',
    name: 'Dia tranquilo',
    description: 'Inimigos com 30% menos vida, mas 20% menos XP. Hoje o servidor está de folga.',
    enemyHpPercent: -30,
    xpPercent: -20,
  },
  {
    id: 'hackathon-relampago',
    name: 'Hackathon relâmpago',
    description: 'Inimigos com 50% mais vida e dano; XP dobrado e loot 50% melhor. Dura o fim de semana todo.',
    enemyHpPercent: 50,
    enemyDamagePercent: 50,
    xpPercent: 100,
    lootQuality: 50,
  },
];
