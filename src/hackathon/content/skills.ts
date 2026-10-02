import type { ActiveSkillDef } from './types';

export const skills: ActiveSkillDef[] = [
  {
    id: 'refatorar',
    name: 'Refatorar',
    emoji: '🔧',
    description: 'Recupera 25% da vida máxima. O código fica igual, só que melhor.',
    cooldownMs: 20_000,
    effect: { kind: 'heal', percentOfMaxHp: 25 },
  },
  {
    id: 'deploy',
    name: 'Deploy',
    emoji: '🚀',
    description: 'Acerta todos os inimigos de uma vez com 2x o seu golpe. Em produção, claro.',
    cooldownMs: 15_000,
    effect: { kind: 'aoe', hitMultiplier: 2 },
  },
  {
    id: 'firewall',
    name: 'Firewall',
    emoji: '🛡️',
    description: 'Bloqueia o próximo golpe sofrido, por até 8 segundos. Ótimo contra golpes anunciados.',
    cooldownMs: 16_000,
    effect: { kind: 'block', durationMs: 8_000 },
  },
  {
    id: 'cafe-duplo',
    name: 'Café duplo',
    emoji: '☕',
    description: 'Dobra a velocidade de ataque por 5 segundos. Efeito colateral: tremedeira.',
    cooldownMs: 20_000,
    effect: { kind: 'haste', attackSpeedMultiplier: 2, durationMs: 5_000 },
  },
];
