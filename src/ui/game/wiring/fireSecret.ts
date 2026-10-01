import { useGame } from '@/game/store';

/** Fires a secret trigger once; later calls are free because the save already remembers it. */
export function fireSecret(trigger: string): void {
  const store = useGame.getState();
  if (store.state.secrets[trigger]) return;
  store.triggerSecret(trigger);
}
