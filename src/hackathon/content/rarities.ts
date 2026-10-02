import type { RarityDef } from './types';

/** Weights sum to 100. Extra affixes are rolled besides the base's primary one. */
export const rarities: RarityDef[] = [
  { id: 'comum', name: 'Comum', weight: 60, extraAffixes: 0, valueMultiplier: 1, recycleCommits: 5 },
  { id: 'incomum', name: 'Incomum', weight: 26, extraAffixes: 1, valueMultiplier: 1.25, recycleCommits: 12 },
  { id: 'raro', name: 'Raro', weight: 10, extraAffixes: 1, valueMultiplier: 1.6, recycleCommits: 30 },
  { id: 'epico', name: 'Épico', weight: 3.3, extraAffixes: 2, valueMultiplier: 2, recycleCommits: 80 },
  { id: 'lendario', name: 'Lendário', weight: 0.7, extraAffixes: 2, valueMultiplier: 2.5, recycleCommits: 250 },
];
