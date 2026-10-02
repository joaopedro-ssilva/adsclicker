import type { CargoDef } from './types';

export const cargos: CargoDef[] = [
  {
    id: 'estudante',
    name: 'Estudante',
    order: 1,
    maxLevel: 10,
    skillSlots: 1,
    classroomMultiplier: 1,
    promotionStage: 'cap1-chefao',
    body: 'hackathon/bodies/estudante',
  },
  {
    id: 'estagiario',
    name: 'Estagiário',
    order: 2,
    maxLevel: 20,
    skillSlots: 2,
    classroomMultiplier: 1.25,
    promotionStage: null,
    body: 'hackathon/bodies/estagiario',
  },
];
