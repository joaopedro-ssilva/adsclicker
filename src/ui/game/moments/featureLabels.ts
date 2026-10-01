import type { Feature } from '@/game/content/types';

/** The name of each game layer as the player knows it. */
export const FEATURE_LABEL: Record<Feature, string> = {
  combo: 'Combo e críticos',
  offline: 'Ganho offline e cliques automáticos',
  bulkBuy: 'Compra em lote',
  hudThemes: 'Temas da interface',
  events: 'Invasões',
  abilities: 'Habilidades',
  sprints: 'Sprints',
  synergy: 'Sinergia entre professores',
  graduation: 'Formatura',
  complexity: 'Complexidade',
};
