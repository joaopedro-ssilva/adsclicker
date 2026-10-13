import { useEffect, useState } from 'react';
import { useGame } from '@/game/store';

/**
 * The latest content patch, announced once to returning players. Bump `id` (and the lists) for the next
 * one: everyone who saw the previous announcement sees the new one once.
 */
export const PATCH = {
  id: '2026-10-recompensas',
  skins: [
    'wagner-elite',
    'pablo-sensei',
    'edecio-luvas',
    'b2-curadora',
    'gladimir-explorador',
    'b2-look',
    'wagner-cafe',
    'guto-sextou',
    'b1-burndown',
    'angelo-escala',
    'pablo-trader',
  ],
  sceneries: ['cofre', 'aurora', 'sala-de-planning', 'camarim'],
  themes: ['holografico', 'platina', 'prata'],
} as const;

const KEY = 'adsclicker.seenPatch';

function readSeen(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function markSeen(): void {
  try {
    window.localStorage.setItem(KEY, PATCH.id);
  } catch {
    // Without storage the announcement comes back on the next visit, which is harmless.
  }
}

/**
 * Whether to show the patch announcement. Decided once per visit: a player who already had progress and
 * has not seen this patch gets it; a brand-new player is marked as seen, since everything is new to them.
 */
export function useWhatsNew(): { open: boolean; close: () => void } {
  // The game screen only renders after boot, on the client, so the save and storage are there to read.
  const [decision] = useState(() => {
    if (readSeen() === PATCH.id) return 'seen';
    const { counters, lifetimeCoins } = useGame.getState().state;
    return counters.clicks > 0 || lifetimeCoins.gt(0) ? 'show' : 'new-player';
  });
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (decision === 'new-player') markSeen();
  }, [decision]);

  const close = () => {
    markSeen();
    setClosed(true);
  };
  return { open: decision === 'show' && !closed, close };
}
