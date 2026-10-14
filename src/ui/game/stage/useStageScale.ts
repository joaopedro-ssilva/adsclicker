'use client';
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** Native height of a composed professor (hat included), a little generous so the sprite never overflows. */
const SPRITE_HEIGHT = 112;
const MIN_SCALE = 2;
const MAX_SCALE = 5;

interface StageScale {
  ref: RefObject<HTMLDivElement | null>;
  /** Integer zoom of the professor sprite. */
  scale: number;
}

/**
 * Picks the largest whole-number sprite scale that leaves room for the HUD around the professor.
 * `reserved` (a stable function) returns the height the HUD takes: top bar, bubble, roster.
 */
export function useStageScale(reserved: (stage: { width: number; height: number }) => number): StageScale {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(3);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => {
      const box = { width: node.clientWidth, height: node.clientHeight };
      const room = box.height - reserved(box);
      const byHeight = Math.floor(room / SPRITE_HEIGHT);
      const byWidth = Math.floor((box.width * 0.5) / 64);
      setScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, byHeight, byWidth)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [reserved]);

  return { ref, scale };
}
