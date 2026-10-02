import type { MentorDef } from './types';

/** The 8 professors, in hire order. Each level adds the modifiers once; costs are Commits. */
export const mentors: MentorDef[] = [
  {
    professor: 'edecio',
    teaches: 'Muito legal! Lógica de programação é dar um passo de cada vez. Cada nível: +4% de dano. 👍',
    modifiers: [{ target: 'logica', op: 'pct', value: 4 }],
    costs: [60, 150, 350, 800, 1800],
  },
  {
    professor: 'gladimir',
    teaches: 'Todo bom banco guarda um extra: que a Força esteja com seu drop! Cada nível: +3% de chance de item extra.',
    modifiers: [{ target: 'dropExtra', op: 'add', value: 3 }],
    costs: [80, 200, 450, 1000, 2200],
  },
  {
    professor: 'b2',
    teaches: 'Bom design deixa o melhor à vista. Cada nível: +4% de qualidade do loot.',
    modifiers: [{ target: 'lootQuality', op: 'add', value: 4 }],
    costs: [90, 220, 500, 1100, 2400],
  },
  {
    professor: 'wagner',
    teaches: 'Defesa em camadas: senha forte, firewall e atenção. Cada nível: +5 de Resiliência.',
    modifiers: [{ target: 'resiliencia', op: 'add', value: 5 }],
    costs: [100, 250, 550, 1200, 2600],
  },
  {
    professor: 'guto',
    teaches: 'Bora escalar na vibe, sem parar a resenha! Cada nível: +4% de velocidade de ataque.',
    modifiers: [{ target: 'agilidade', op: 'pct', value: 4 }],
    costs: [110, 270, 600, 1350, 2900],
  },
  {
    professor: 'b1',
    teaches: 'Todo sprint merece entrega e recompensa. Cada nível: +6% de Commits ganhos.',
    modifiers: [{ target: 'commitsGain', op: 'add', value: 6 }],
    costs: [120, 300, 650, 1450, 3100],
  },
  {
    professor: 'angelo',
    teaches: 'Registre-se em ata: equipamento combinado rende mais que equipamento solto. Cada nível: +10% nos bônus de conjunto.',
    modifiers: [{ target: 'setBonus', op: 'add', value: 10 }],
    costs: [140, 340, 750, 1600, 3400],
  },
  {
    professor: 'pablo',
    teaches: 'Todo chefão é um problema grande bem dividido, e você consegue. Cada nível: +6% de dano contra chefões.',
    modifiers: [{ target: 'bossDamage', op: 'add', value: 6 }],
    costs: [160, 400, 850, 1800, 3800],
  },
];
