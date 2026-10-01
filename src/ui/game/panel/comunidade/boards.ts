import type { Board } from '@/shared/api';
import type { IconName } from '@/ui/kit';

export interface BoardInfo {
  board: Board;
  label: string;
  icon: IconName;
  /** Unit shown after the value in a row ("diplomas"). */
  unit: string;
}

export const BOARD_INFO: readonly BoardInfo[] = [
  { board: 'coins', label: 'ADScoins', icon: 'coin', unit: 'ADScoins' },
  { board: 'diplomas', label: 'Diplomas', icon: 'diploma', unit: 'diplomas' },
  { board: 'achievements', label: 'Conquistas', icon: 'trophy', unit: 'conquistas' },
  { board: 'clicks', label: 'Cliques', icon: 'click', unit: 'cliques' },
];
