import type { MentorDef } from './types';

/** The 8 professors, in hire order. Each level adds the modifiers once; costs are Commits. */
export const mentors: MentorDef[] = [
  {
    professor: 'edecio',
    teaches: 'Muito legal! Lógica de programação é dar um passo de cada vez. Cada nível: +4% de dano. 👍',
    modifiers: [{ target: 'logica', op: 'pct', value: 4 }],
    costs: [250, 640, 1480, 3370, 7580],
  },
  {
    professor: 'gladimir',
    teaches: 'Todo bom banco guarda um extra: que a Força esteja com seu drop! Cada nível: +3% de chance de item extra.',
    modifiers: [{ target: 'dropExtra', op: 'add', value: 3 }],
    costs: [340, 840, 1900, 4210, 9260],
  },
  {
    professor: 'b2',
    teaches: 'Bom design deixa o melhor à vista. Cada nível: +4% de qualidade do loot.',
    modifiers: [{ target: 'lootQuality', op: 'add', value: 4 }],
    costs: [380, 920, 2110, 4630, 10100],
  },
  {
    professor: 'wagner',
    teaches: 'Defesa em camadas: senha forte, firewall e atenção. Cada nível: +5 de Resiliência.',
    modifiers: [{ target: 'resiliencia', op: 'add', value: 5 }],
    costs: [420, 1060, 2320, 5050, 10960],
  },
  {
    professor: 'guto',
    teaches: 'Bora escalar na vibe, sem parar a resenha! Cada nível: +4% de velocidade de ataque.',
    modifiers: [{ target: 'agilidade', op: 'pct', value: 4 }],
    costs: [470, 1140, 2530, 5690, 12220],
  },
  {
    professor: 'b1',
    teaches: 'Todo sprint merece entrega e recompensa. Cada nível: +6% de Commits ganhos.',
    modifiers: [{ target: 'commitsGain', op: 'add', value: 6 }],
    costs: [500, 1260, 2740, 6110, 13060],
  },
  {
    professor: 'angelo',
    teaches: 'Registre-se em ata: equipamento combinado rende mais que equipamento solto. Cada nível: +10% nos bônus de conjunto.',
    modifiers: [{ target: 'setBonus', op: 'add', value: 10 }],
    costs: [590, 1430, 3160, 6740, 14320],
  },
  {
    professor: 'pablo',
    teaches: 'Todo chefão é um problema grande bem dividido, e você consegue. Cada nível: +6% de dano contra chefões.',
    modifiers: [{ target: 'bossDamage', op: 'add', value: 6 }],
    costs: [670, 1680, 3580, 7580, 16010],
  },
];
