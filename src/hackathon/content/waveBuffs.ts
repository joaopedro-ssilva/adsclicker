import type { WaveBuffDef } from './types';

/** Offered three at a time between waves; they last until the stage ends. */
export const waveBuffs: WaveBuffDef[] = [
  {
    id: 'cafe-forte',
    name: 'Café forte',
    emoji: '☕',
    description: '+25% de velocidade de ataque até o fim da fase.',
    modifiers: [{ target: 'agilidade', op: 'pct', value: 25 }],
  },
  {
    id: 'stack-overflow',
    name: 'Resposta do Stack Overflow',
    emoji: '📚',
    description: '+30% de dano até o fim da fase. Copiou? Copiou. Funcionou? Funcionou.',
    modifiers: [{ target: 'logica', op: 'pct', value: 30 }],
  },
  {
    id: 'foco-total',
    name: 'Foco total',
    emoji: '🎯',
    description: '+15 de Atenção (chance de crítico) até o fim da fase.',
    modifiers: [{ target: 'atencao', op: 'add', value: 15 }],
  },
  {
    id: 'code-review',
    name: 'Code review',
    emoji: '🧐',
    description: '+15 de Resiliência até o fim da fase. Alguém achou o bug antes de você.',
    modifiers: [{ target: 'resiliencia', op: 'add', value: 15 }],
  },
  {
    id: 'firewall-extra',
    name: 'Firewall extra',
    emoji: '🧱',
    description: '+25 de Resiliência até o fim da fase, para quem prefere defender.',
    modifiers: [{ target: 'resiliencia', op: 'add', value: 25 }],
  },
  {
    id: 'refatoracao-rapida',
    name: 'Refatoração rápida',
    emoji: '🔧',
    description: 'Cura 30% da vida máxima agora.',
    modifiers: [],
    heal: { percentOfMaxHp: 30 },
  },
  {
    id: 'backup-na-nuvem',
    name: 'Backup na nuvem',
    emoji: '💾',
    description: 'Cura 50% da vida máxima agora. Restaurar é sempre melhor que refazer.',
    modifiers: [],
    heal: { percentOfMaxHp: 50 },
  },
  {
    id: 'pausa-para-agua',
    name: 'Pausa para água',
    emoji: '💧',
    description: 'Cura 20% da vida e dá +10% de vida máxima até o fim da fase.',
    modifiers: [{ target: 'foco', op: 'pct', value: 10 }],
    heal: { percentOfMaxHp: 20 },
  },
  {
    id: 'pair-programming',
    name: 'Pair programming',
    emoji: '👯',
    description: '+15% de dano e +8 de Resiliência até o fim da fase. Duas cabeças, um teclado.',
    modifiers: [
      { target: 'logica', op: 'pct', value: 15 },
      { target: 'resiliencia', op: 'add', value: 8 },
    ],
  },
  {
    id: 'automacao',
    name: 'Automação',
    emoji: '🤖',
    description: 'Habilidades 30% mais fortes e 30% mais rápidas de recarregar até o fim da fase.',
    modifiers: [
      { target: 'skillPower', op: 'add', value: 30 },
      { target: 'cooldown', op: 'add', value: 30 },
    ],
  },
  {
    id: 'deploy-na-sexta',
    name: 'Deploy na sexta',
    emoji: '🎲',
    description: 'Aposta: +60% de dano, mas -25% de vida máxima até o fim da fase. O que poderia dar errado?',
    modifiers: [
      { target: 'logica', op: 'pct', value: 60 },
      { target: 'foco', op: 'pct', value: -25 },
    ],
  },
  {
    id: 'tudo-ou-nada',
    name: 'Tudo ou nada',
    emoji: '🎰',
    description: 'Aposta: +30 de Atenção (crítico quase certo), mas -20% de vida máxima até o fim da fase.',
    modifiers: [
      { target: 'atencao', op: 'add', value: 30 },
      { target: 'foco', op: 'pct', value: -20 },
    ],
  },
];
