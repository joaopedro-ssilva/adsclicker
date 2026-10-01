'use client';
import { useEffect, useState } from 'react';
import type { Decimal } from '@/game/engine/decimal';
import { formatNumber } from '@/game/engine/format';
import { useReducedMotion } from '@/ui/useReducedMotion';

interface CountUpProps {
  value: Decimal | number;
  durationMs?: number;
  /** Delay before the count starts. */
  delayMs?: number;
  className?: string;
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** Counts from zero up to `value` (a Decimal or a number), formatted like every other number in the game. */
export function CountUp({ value, durationMs = 1100, delayMs = 250, className }: CountUpProps) {
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    const startAt = performance.now() + delayMs;
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - startAt) / durationMs));
      setProgress(easeOut(t));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [reduced, durationMs, delayMs]);

  const shown = progress >= 1 ? value : typeof value === 'number' ? value * progress : value.mul(progress);
  return <span className={className}>{formatNumber(shown, { integer: true })}</span>;
}
