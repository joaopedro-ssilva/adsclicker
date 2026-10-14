'use client';
import { useEffect, useState } from 'react';
import { IconButton } from '@/ui/kit';
import { useReducedMotion } from '@/ui/useReducedMotion';
import { useMoments } from '../moments/momentsStore';
import { useUi } from '../shared/uiStore';
import { shortcutKey } from './shortcutList';

const IDLE_MS = 3500;

/**
 * The only control left in photo mode: a small eye that leaves it. It fades after a few seconds without input and
 * comes back on a mouse move, a tap or a key; with reduced motion it simply stays. Esc leaves too (see ShortcutsHost).
 */
export function PhotoExit() {
  const setPhoto = useUi((store) => store.setPhoto);
  const reduced = useReducedMotion();
  const [awake, setAwake] = useState(true);
  // A ceremony (graduation, a hire, an unlock) needs the screen and its effects: photo mode steps aside.
  const ceremony = useMoments((store) => store.queue.length > 0);

  useEffect(() => {
    if (ceremony) setPhoto(false);
  }, [ceremony, setPhoto]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wake = () => {
      setAwake(true);
      clearTimeout(timer);
      timer = setTimeout(() => setAwake(false), IDLE_MS);
    };
    wake();
    window.addEventListener('pointermove', wake, { passive: true });
    window.addEventListener('pointerdown', wake, { passive: true });
    window.addEventListener('keydown', wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('keydown', wake);
    };
  }, []);

  return (
    <div className="photo-exit" data-awake={awake || reduced} data-qa="photo-exit">
      <IconButton
        icon="eye"
        label="Sair do modo foto"
        title={`Sair do modo foto (${shortcutKey('leave-photo')})`}
        variant="secondary"
        size="sm"
        onClick={() => setPhoto(false)}
      />
    </div>
  );
}
