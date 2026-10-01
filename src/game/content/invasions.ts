import type { BuffDef, InvasionDef } from './types';

const clickTurbo: BuffDef = {
  id: 'buff-invasion-click',
  name: 'Clique Turbo',
  emoji: '⚡',
  durationMs: 15_000,
  effects: [{ stat: 'clickPower', op: 'mult', value: 10 }],
};

const productionTurbo: BuffDef = {
  id: 'buff-invasion-production',
  name: 'Produção Turbo',
  emoji: '🔥',
  durationMs: 30_000,
  effects: [{ stat: 'idlePower', op: 'mult', value: 3 }],
};

/** Threats on the stage (Wagner's layer). Rewards are 15 to 150 seconds of production or a short buff. */
export const invasions: InvasionDef[] = [
  {
    id: 'phishing',
    name: 'Phishing',
    emoji: '🎣',
    description: 'Um e-mail suspeito pede seus dados. Clique para denunciar antes que ele suma. Rende 15 s de produção.',
    weight: 30,
    windowMs: 9_000,
    clicksRequired: 3,
    reward: { kind: 'coins', seconds: 15 },
  },
  {
    id: 'senha-123456',
    name: 'Senha 123456',
    emoji: '🔑',
    description: 'Alguém ainda usa essa senha. Clique para trocar por uma boa. Rende 30 s de produção.',
    weight: 25,
    windowMs: 8_000,
    clicksRequired: 5,
    reward: { kind: 'coins', seconds: 30 },
  },
  {
    id: 'sql-injection',
    name: 'SQL Injection',
    emoji: '💉',
    description: 'Um formulário aceitou texto demais. Clique para sanitizar. Dá clique x10 por 15 s.',
    weight: 20,
    windowMs: 8_000,
    clicksRequired: 6,
    reward: { kind: 'buff', buff: clickTurbo },
  },
  {
    id: 'ddos',
    name: 'DDoS',
    emoji: '🌊',
    description: 'Uma onda de acessos derruba o servidor. Clique rápido para segurar. Rende 75 s de produção.',
    weight: 15,
    windowMs: 7_000,
    clicksRequired: 12,
    reward: { kind: 'coins', seconds: 75 },
  },
  {
    id: 'engenharia-social',
    name: 'Engenharia Social',
    emoji: '🎭',
    description: 'Alguém ligou fingindo ser do suporte. Clique para desligar. Dá produção x3 por 30 s.',
    weight: 10,
    windowMs: 8_000,
    clicksRequired: 8,
    reward: { kind: 'buff', buff: productionTurbo },
  },
  {
    id: 'ransomware',
    name: 'Ransomware',
    emoji: '🔒',
    description: 'Arquivos trancados pedindo resgate. Clique muitas vezes para destrancar. Rende 150 s de produção.',
    weight: 8,
    windowMs: 10_000,
    clicksRequired: 15,
    reward: { kind: 'coins', seconds: 150 },
  },
];
