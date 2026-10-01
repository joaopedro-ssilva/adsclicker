'use client';
import { useEffect } from 'react';
import { useGame } from '@/game/store';
import { DEV_MULTIPLIER_KEY, readDevMultiplier } from '@/ui/dev/devMultiplier';

/** Keeps the game's coin multiplier equal to what the /admin page stored, on boot and while it changes in another tab. */
export function DevMultiplierSync() {
  useEffect(() => {
    const apply = () => {
      const multiplier = readDevMultiplier();
      const store = useGame.getState();
      if (store.state.settings.devMultiplier !== multiplier) store.updateSettings({ devMultiplier: multiplier });
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === DEV_MULTIPLIER_KEY) apply();
    };
    apply();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return null;
}
