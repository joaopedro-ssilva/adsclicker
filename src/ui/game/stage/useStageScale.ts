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
  /** The stage is narrow or stacked over the panel (phones, tablets): the HUD takes its phone layout. */
  compact: boolean;
}

/**
 * Picks the largest whole-number sprite scale that leaves room for the HUD around the professor.
 * `reserved` (a stable function) returns the height the HUD takes: top bar, bubble, roster.
 */
export function useStageScale(reserved: (stage: { width: number; height: number; compact: boolean }) => number): StageScale {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(3);
  const [compact, setCompact] = useState(false);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => {
      // Phones, and the stacked layout up to tablets (stage above the panel, see shell.css): the phone HUD.
      const isCompact = node.clientWidth < 640 || window.matchMedia('(max-width: 1023px)').matches;
      const box = { width: node.clientWidth, height: node.clientHeight, compact: isCompact };
      const room = box.height - reserved(box);
      const byHeight = Math.floor(room / SPRITE_HEIGHT);
      const byWidth = Math.floor((box.width * 0.5) / 64);
      setCompact(isCompact);
      setScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, byHeight, byWidth)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [reserved]);

  return { ref, scale, compact };
}
