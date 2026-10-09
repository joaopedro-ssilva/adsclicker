import type { MasteryDef, ProfessorId } from './types';

/**
 * Domínio: each professor has a rank, one per `balance.mastery.step` levels summed over their
 * disciplines in the current run (capped at `balance.mastery.cap`). The rank pays a bonus on the
 * mechanic that professor owns, and the bonus reaches the whole game, not only their own classes.
 * Numbers are per rank; at the cap of 40 ranks they come to:
 *
 * | Professor | Per rank                  | At the cap                           |
 * | --------- | ------------------------- | ------------------------------------ |
 * | Edécio    | click +0.15% of coins/s   | each click adds +6% of coins/s       |
 * | Gladimir  | +0.15 h cap, +0.5 pt rate | +6 h offline cap, +20 points of rate |
 * | B2        | costs x0.99               | every cost -33%                      |
 * | Wagner    | invasion reward +2.5%     | invasion rewards x2                  |
 * | Guto      | duration +1%, cooldown x0.99 | buffs +40% longer, cooldowns -33% |
 * | B1        | sprint reward +2.5%       | sprint rewards x2                    |
 * | Angelo    | diplomas +0.5%            | +20% diplomas per graduation         |
 * | Pablo     | all production x1.0075    | x1.35 (compounds)                    |
 *
 * The honoured professor (picked at graduation, for the next run) gets a stronger version of the
 * same mechanic; Pablo's and B2's doubling is the same effect pushed a second time per rank.
 */
export const mastery: Record<ProfessorId, MasteryDef> = {
  edecio: {
    professor: 'edecio',
    perRank: [{ stat: 'clickFromIdle', op: 'add', value: 0.0015 }],
    line: 'Cada clique rende a mais {v} do que a turma inteira produz por segundo',
    units: ['percent'],
    honour: {
      name: 'Combo que não cai',
      description: 'O combo nunca diminui durante a turma: clicou uma vez, segura o ritmo.',
      flat: [{ stat: 'comboDecay', op: 'mult', value: 0 }],
    },
  },
  gladimir: {
    professor: 'gladimir',
    perRank: [
      { stat: 'offlineHours', op: 'add', value: 0.15 },
      { stat: 'offlineRate', op: 'add', value: 0.005 },
    ],
    line: 'Offline: conta até {v} a mais de ausência e paga {w} a mais da produção',
    units: ['hours', 'percent'],
    honour: {
      name: 'Backup completo',
      description: 'O ganho offline paga 100% do que a turma produz enquanto você estiver fora.',
      flat: [{ stat: 'offlineRate', op: 'add', value: 1 }],
    },
  },
  b2: {
    professor: 'b2',
    perRank: [{ stat: 'costMult', op: 'mult', value: 0.99 }],
    line: 'Todas as aulas e cliques ficam {v} mais baratos',
    units: ['percent'],
    honour: {
      name: 'Desconto em dobro',
      description: 'O desconto do Domínio da Bruna B2 vale duas vezes na turma.',
      perRank: [{ stat: 'costMult', op: 'mult', value: 0.99 }],
    },
  },
  wagner: {
    professor: 'wagner',
    perRank: [{ stat: 'eventReward', op: 'add', value: 0.025 }],
    line: 'Invasões defendidas pagam {v} a mais',
    units: ['percent'],
    honour: {
      name: 'Alerta máximo',
      description: 'As invasões aparecem duas vezes mais seguido durante a turma.',
      flat: [{ stat: 'eventInterval', op: 'mult', value: 0.5 }],
    },
  },
  guto: {
    professor: 'guto',
    perRank: [
      { stat: 'abilityDuration', op: 'add', value: 0.01 },
      { stat: 'abilityCooldown', op: 'mult', value: 0.99 },
    ],
    line: 'Buffs duram {v} a mais e as habilidades recarregam {w} mais rápido',
    units: ['percent', 'percent'],
    honour: {
      name: 'Recarga pela metade',
      description: 'As habilidades recarregam na metade do tempo durante a turma.',
      flat: [{ stat: 'abilityCooldown', op: 'mult', value: 0.5 }],
    },
  },
  b1: {
    professor: 'b1',
    perRank: [{ stat: 'sprintReward', op: 'add', value: 0.025 }],
    line: 'Sprints concluídos pagam {v} a mais',
    units: ['percent'],
    honour: {
      name: 'Entrega em dobro',
      description: 'Os sprints concluídos pagam o dobro durante a turma.',
      flat: [{ stat: 'sprintReward', op: 'mult', value: 2 }],
    },
  },
  angelo: {
    professor: 'angelo',
    perRank: [{ stat: 'diplomaGain', op: 'add', value: 0.005 }],
    line: 'Cada formatura rende {v} a mais em diplomas',
    units: ['percent'],
    honour: {
      name: 'Formatura de honra',
      description: 'A formatura desta turma rende 25% mais diplomas.',
      flat: [{ stat: 'diplomaGain', op: 'mult', value: 1.25 }],
    },
  },
  pablo: {
    professor: 'pablo',
    perRank: [{ stat: 'globalPower', op: 'mult', value: 1.0075 }],
    line: 'Toda a produção da turma sobe {v}',
    units: ['percent'],
    honour: {
      name: 'Complexidade dobrada',
      description: 'O bônus de produção do Domínio do Pablo vale duas vezes na turma.',
      perRank: [{ stat: 'globalPower', op: 'mult', value: 1.0075 }],
    },
  },
};
