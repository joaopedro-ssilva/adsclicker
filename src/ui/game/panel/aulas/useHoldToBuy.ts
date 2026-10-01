import { useCallback, useEffect, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';

const HOLD_DELAY_MS = 420;
const FIRST_INTERVAL_MS = 170;
const MIN_INTERVAL_MS = 55;

export interface HoldHandlers {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onKeyUp: (event: KeyboardEvent<HTMLElement>) => void;
  onClick: (event: MouseEvent<HTMLElement>) => void;
  onContextMenu: (event: MouseEvent<HTMLElement>) => void;
}

/**
 * Press-and-hold to repeat a purchase. `attempt` buys once and returns whether it worked; the repeat stops
 * as soon as it fails (out of coins).
 *
 * A mouse buys on pointer down, which feels instant. Touch and pen buy on release instead, so that starting
 * a scroll on a card never buys by accident; a long press still starts repeating (the first repeat happens
 * after the delay). Keyboard (Enter/Space, with the OS key repeat) and assistive-tech clicks are handled apart.
 */
export function useHoldToBuy(attempt: (element: HTMLElement) => boolean): HoldHandlers {
  const delay = useRef<number | undefined>(undefined);
  const repeat = useRef<number | undefined>(undefined);
  const holding = useRef(false);
  const pending = useRef(false);
  const latest = useRef(attempt);

  useEffect(() => {
    latest.current = attempt;
  });

  const stop = useCallback(() => {
    window.clearTimeout(delay.current);
    window.clearTimeout(repeat.current);
    delay.current = undefined;
    repeat.current = undefined;
    holding.current = false;
    pending.current = false;
  }, []);

  useEffect(() => stop, [stop]);

  const startRepeating = useCallback(
    (element: HTMLElement) => {
      let interval = FIRST_INTERVAL_MS;
      const step = () => {
        if (!latest.current(element)) {
          stop();
          return;
        }
        interval = Math.max(MIN_INTERVAL_MS, interval * 0.9);
        repeat.current = window.setTimeout(step, interval);
      };
      step();
    },
    [stop],
  );

  return {
    onPointerDown(event) {
      if (event.button !== 0) return;
      stop();
      const element = event.currentTarget;
      if (event.pointerType === 'mouse') {
        if (!latest.current(element)) return;
        holding.current = true;
        delay.current = window.setTimeout(() => startRepeating(element), HOLD_DELAY_MS);
        return;
      }
      pending.current = true;
      delay.current = window.setTimeout(() => {
        pending.current = false;
        holding.current = true;
        startRepeating(element);
      }, HOLD_DELAY_MS);
    },
    onPointerUp(event) {
      const tap = pending.current;
      stop();
      if (tap) latest.current(event.currentTarget);
    },
    onPointerLeave: stop,
    onPointerCancel: stop,
    onKeyDown(event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      latest.current(event.currentTarget);
    },
    onKeyUp(event) {
      // Space clicks on key up; the purchase already happened on key down.
      if (event.key === ' ') event.preventDefault();
    },
    onClick(event) {
      // detail is 0 for clicks that do not come from a pointer (screen readers, voice control).
      if (event.detail === 0) latest.current(event.currentTarget);
    },
    onContextMenu: (event) => event.preventDefault(),
  };
}
