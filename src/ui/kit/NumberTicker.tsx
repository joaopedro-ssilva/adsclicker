'use client';
import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../useReducedMotion';

export interface NumberTickerProps {
  /** The already formatted number, for example "12,5 K". */
  value: string;
  /** The raw number behind it. Only its direction of change matters (up rolls in from below, down from above). */
  numericHint: number;
  className?: string;
}

/** How long a digit must have stayed the same before its next change is animated. */
const STILL_BEFORE_ROLL_MS = 900;

/** Characters are matched from the right, so "9.999" to "10.000" only rolls the digits that changed. */
export function NumberTicker({ value, numericHint, className }: NumberTickerProps) {
  const reduced = useReducedMotion();
  const cells = useRef(new Map<number, HTMLSpanElement>());
  const previous = useRef({ value, hint: numericHint });
  const lastChange = useRef(new Map<number, number>());

  useEffect(() => {
    const before = previous.current;
    previous.current = { value, hint: numericHint };
    const direction = Math.sign(numericHint - before.hint);
    if (reduced || direction === 0 || before.value === value) return;

    const now = performance.now();
    const animations: Animation[] = [];
    const next = [...value];
    const old = [...before.value];
    for (let fromRight = 0; fromRight < next.length; fromRight += 1) {
      if (next[next.length - 1 - fromRight] === old[old.length - 1 - fromRight]) continue;
      // A digit that changes many times a second would be mid-roll all the time and unreadable:
      // only digits that had been still for a while roll, the fast ones just swap.
      const sinceLastChange = now - (lastChange.current.get(fromRight) ?? -Infinity);
      lastChange.current.set(fromRight, now);
      if (sinceLastChange < STILL_BEFORE_ROLL_MS) continue;
      const animation = cells.current.get(fromRight)?.animate(
        [
          { transform: `translateY(${direction * 55}%)`, opacity: 0.2 },
          { transform: `translateY(${direction * -8}%)`, opacity: 1, offset: 0.7 },
          { transform: 'translateY(0)', opacity: 1 },
        ],
        { duration: 260, delay: Math.min(fromRight, 4) * 18, easing: 'steps(5, end)', fill: 'backwards' },
      );
      if (animation) animations.push(animation);
    }
    return () => animations.forEach((animation) => animation.cancel());
  }, [value, numericHint, reduced]);

  const characters = [...value];
  return (
    <span className={className ? `ui-number ${className}` : 'ui-number'}>
      <span className="sr-only">{value}</span>
      <span aria-hidden="true">
        {characters.map((character, index) => {
          const fromRight = characters.length - 1 - index;
          return (
            <span
              key={fromRight}
              className="ui-number-cell"
              ref={(node) => {
                if (node) cells.current.set(fromRight, node);
                else cells.current.delete(fromRight);
              }}
            >
              {character}
            </span>
          );
        })}
      </span>
    </span>
  );
}
