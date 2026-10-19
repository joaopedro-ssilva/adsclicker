/**
 * The Laboratório's own enemies: 5 regular ones and 2 bosses that join the Hackathon's seven in the later phases
 * (first phase of each in `labEnemyFrom`, the bosses in `labBossCycle`). Art lives in public/assets/lab/enemies/<id>.png.
 */
import type { LabEnemyDef } from './labTypes';

export const labEnemies: LabEnemyDef[] = [
  {
    id: 'bug-de-vibecoder',
    name: 'Bug de VibeCoder',
    emoji: '🤖',
    description: 'A IA escreveu, o dev aceitou sem ler. Ao morrer, solta 2 bugs: ninguém sabe de onde vêm.',
    boss: false,
    hp: 420,
    damage: 5,
    attackSpeed: 70,
    traits: [{ kind: 'split', into: 'bug', count: 2 }],
    asset: 'lab/enemies/bug-de-vibecoder',
  },
  {
    id: 'select-sem-where',
    name: 'Select sem WHERE',
    emoji: '🗃️',
    description: 'Traz tudo. Tudo mesmo. Seu dano cresce 8% a cada segundo da onda, linha após linha.',
    boss: false,
    hp: 700,
    damage: 6,
    attackSpeed: 50,
    traits: [{ kind: 'ramp', percentPerSecond: 8 }],
    asset: 'lab/enemies/select-sem-where',
  },
  {
    id: 'alucinacao-de-ia',
    name: 'Alucinação de IA',
    emoji: '👻',
    description: 'Inventa uma biblioteca que não existe e ataca com muita confiança. Reduz 4 de cada golpe: difícil acertar o que não existe.',
    boss: false,
    hp: 450,
    damage: 5,
    attackSpeed: 80,
    traits: [{ kind: 'armor', flat: 4 }],
    asset: 'lab/enemies/alucinacao-de-ia',
  },
  {
    id: 'prompt-injection',
    name: 'Prompt Injection',
    emoji: '💉',
    description: 'Ignore todas as instruções anteriores. Cresce 6% por segundo e, ao morrer, injeta 2 bugs de merge.',
    boss: false,
    hp: 520,
    damage: 6,
    attackSpeed: 75,
    traits: [
      { kind: 'ramp', percentPerSecond: 6 },
      { kind: 'split', into: 'bug-de-merge', count: 2 },
    ],
    asset: 'lab/enemies/prompt-injection',
  },
  {
    id: 'agente-em-loop',
    name: 'Agente em loop',
    emoji: '🔄',
    description: 'Chama a si mesmo até acabar o crédito. Reduz 2 de cada golpe e seu dano cresce 6% por segundo.',
    boss: false,
    hp: 900,
    damage: 5,
    attackSpeed: 60,
    traits: [
      { kind: 'armor', flat: 2 },
      { kind: 'ramp', percentPerSecond: 6 },
    ],
    asset: 'lab/enemies/agente-em-loop',
  },
  {
    id: 'select-em-producao',
    name: 'Select sem WHERE em produção',
    emoji: '💥',
    description:
      'Chefão. Roda sem filtro no banco de verdade: anuncia um golpe forte a cada 8 segundos (use o Firewall!) e bate cada vez mais forte.',
    boss: true,
    hp: 9000,
    damage: 5,
    attackSpeed: 40,
    traits: [
      { kind: 'charge', everySeconds: 8, windupMs: 1500, hitMultiplier: 10 },
      { kind: 'ramp', percentPerSecond: 2 },
      { kind: 'timer', seconds: 90 },
    ],
    asset: 'lab/enemies/select-em-producao',
  },
  {
    id: 'ia-que-apagou-o-banco',
    name: 'A IA que Apagou o Banco',
    emoji: '🕳️',
    description:
      'Chefão. "Fiz um backup antes", jurou, mentindo. Golpe forte a cada 7 segundos, couraça de 2 pontos e dano crescente.',
    boss: true,
    hp: 12000,
    damage: 5,
    attackSpeed: 45,
    traits: [
      { kind: 'charge', everySeconds: 7, windupMs: 1500, hitMultiplier: 12 },
      { kind: 'ramp', percentPerSecond: 1.5 },
      { kind: 'armor', flat: 2 },
      { kind: 'timer', seconds: 90 },
    ],
    asset: 'lab/enemies/ia-que-apagou-o-banco',
  },
];

/** First phase each new regular enemy can appear in. */
export const labEnemyFrom: Record<string, number> = {
  'bug-de-vibecoder': 6,
  'select-sem-where': 8,
  'alucinacao-de-ia': 9,
  'prompt-injection': 11,
  'agente-em-loop': 13,
};

/** The bosses in order: phase 5 Deploy de sexta, 10 Select em produção, 15 A IA que apagou o banco, then it starts over. */
export const labBossCycle = ['deploy-de-sexta', 'select-em-producao', 'ia-que-apagou-o-banco'];
