import type { AbilityDef } from './types';

/**
 * Cooldown buttons (Guto's layer). Auto Scaling comes with Guto; the others are unlocked by
 * research of other professors, so `professor` is the one whose research opens it.
 */
export const abilities: AbilityDef[] = [
  {
    id: 'auto-scaling',
    professor: 'guto',
    name: 'Auto Scaling',
    emoji: '☁️',
    description: 'Toda a produção das disciplinas x5 por 30 s. Recarga de 10 min. A nuvem cresce sozinha, a vibe também.',
    cooldownMs: 600_000,
    buff: {
      id: 'buff-auto-scaling',
      name: 'Auto Scaling',
      emoji: '☁️',
      durationMs: 30_000,
      effects: [{ stat: 'idlePower', op: 'mult', value: 5 }],
    },
  },
  {
    id: 'aula-show',
    professor: 'edecio',
    name: 'Aula Show',
    emoji: '🎤',
    description: 'O valor de cada clique x10 por 15 s. Recarga de 5 min. A turma inteira recebe um joinha.',
    cooldownMs: 300_000,
    buff: {
      id: 'buff-aula-show',
      name: 'Aula Show',
      emoji: '🎤',
      durationMs: 15_000,
      effects: [{ stat: 'clickPower', op: 'mult', value: 10 }],
    },
    unlockedByResearch: 'edecio-aula-show',
  },
  {
    id: 'hiperespaco',
    professor: 'gladimir',
    name: 'Salto no Hiperespaço',
    emoji: '🚀',
    description: '+20 cliques automáticos por segundo por 20 s. Recarga de 7 min. Calculou a rota? Calculou. Chegou antes.',
    cooldownMs: 420_000,
    buff: {
      id: 'buff-hiperespaco',
      name: 'Hiperespaço',
      emoji: '🚀',
      durationMs: 20_000,
      effects: [{ stat: 'autoClicks', op: 'add', value: 20 }],
    },
    unlockedByResearch: 'gladimir-hiperespaco',
  },
  {
    id: 'big-o',
    professor: 'pablo',
    name: 'Big O',
    emoji: '📈',
    description: 'Disciplinas e upgrades de clique custam metade por 20 s. Recarga de 8 min. Aproveite, é de ordem constante.',
    cooldownMs: 480_000,
    buff: {
      id: 'buff-big-o',
      name: 'Big O',
      emoji: '📈',
      durationMs: 20_000,
      effects: [{ stat: 'costMult', op: 'mult', value: 0.5 }],
    },
    unlockedByResearch: 'pablo-big-o',
  },
];
