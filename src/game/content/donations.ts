import type { DecimalString } from './types';

/**
 * Centro Comunitário: titles earned by the ADScoins given to the campus in total (GameState.donated). One place for
 * the thresholds: the engine, the server board and the UI all read this list. Thresholds are log milestones; the
 * first is within reach of a casual game, the last is a chase of the endgame (a top player makes about 1e45 coins
 * in a lifetime, and donating them means not spending them).
 */
export interface DonationTitleDef {
  id: string;
  name: string;
  emoji: string;
  /** Total donated needed, as a decimal string. */
  threshold: DecimalString;
  /** Short line shown in the milestones list. */
  description: string;
}

export const donationTitles: readonly DonationTitleDef[] = [
  { id: 'voluntario', name: 'Voluntário', emoji: '🙋', threshold: '1e12', description: 'Doou 1 T de ADScoins ao campus.' },
  { id: 'apoiador', name: 'Apoiador', emoji: '🤝', threshold: '1e24', description: 'Doou 1 Sp de ADScoins ao campus.' },
  { id: 'patrocinador', name: 'Patrocinador', emoji: '🏷️', threshold: '1e33', description: 'Doou 1 Dc de ADScoins ao campus.' },
  { id: 'mecenas', name: 'Mecenas', emoji: '🎭', threshold: '1e45', description: 'Doou 1 Qad de ADScoins ao campus.' },
  { id: 'benfeitor', name: 'Benfeitor', emoji: '🏛️', threshold: '1e63', description: 'Doou 1 Vg de ADScoins ao campus.' },
  { id: 'nome-no-predio', name: 'Nome no Prédio', emoji: '🪧', threshold: '1e93', description: 'Doou 1 Tg de ADScoins: seu nome vai na fachada.' },
];

/** Donating every ADScoin in hand at once counts as generous from this sum (1 Sp, the Apoiador threshold). */
export const GENEROUS_DONATION_MIN: DecimalString = '1e24';
/** The `flag` condition (GameState.secrets) the generous donation sets: read by the Doação Generosa achievement. */
export const GENEROUS_DONATION_FLAG = 'donate-all';

export const donationTitleById = new Map(donationTitles.map((title) => [title.id, title]));