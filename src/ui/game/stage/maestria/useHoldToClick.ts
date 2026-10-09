import { useCallback, useEffect, useRef } from 'react';
import { content, useGame } from '@/game/store';
import { joinhaView } from '@/game/engine/views';

/** A tap shorter than this never repeats, so quick taps keep their one click each. */
const HOLD_DELAY_MS = 300;

/**
 * Joinha de Ouro, level 5: holding the pointer on the professor clicks about ten times per second.
 * Each repeat is an ordinary manual click through `perform` (the combo, the crit roll and the click counters see
 * it as any other), and the rate sits well under what the server accepts from a hand. The first click of
 * the press is the caller's; this only adds the ones that follow. Returns `start(x, y)`, to call on pointer down.
 */
export function useHoldToClick(perform: (x: number, y: number) => void): (x: number, y: number) => void {
  const stopRef = useRef<(() => void) | null>(null);
  const latest = useRef(perform);

  useEffect(() => {
    latest.current = perform;
  });

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  return useCallback(
    (x: number, y: number) => {
      stop();
      const view = joinhaView(useGame.getState().state, content);
      if (!view?.canHold) return;

      let at = { x, y };
      let timer: number | undefined;
      const delay = window.setTimeout(() => {
        timer = window.setInterval(() => latest.current(at.x, at.y), 1000 / view.holdPerSecond);
      }, HOLD_DELAY_MS);
      const move = (event: PointerEvent) => {
        at = { x: event.clientX, y: event.clientY };
      };
      const release = () => stop();

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', release);
      window.addEventListener('pointercancel', release);
      window.addEventListener('blur', release);
      stopRef.current = () => {
        window.clearTimeout(delay);
        window.clearInterval(timer);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', release);
        window.removeEventListener('pointercancel', release);
        window.removeEventListener('blur', release);
      };
    },
    [stop],
  );
}
