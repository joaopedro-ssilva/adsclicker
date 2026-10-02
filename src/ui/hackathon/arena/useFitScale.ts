'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { PLAYER_NATIVE } from './arenaLayout';

/**
 * The integer zoom at which the student fits the height of the box of `ref`, once `reserved` pixels of
 * other content are taken out (a phone leaves little room, a desktop a lot).
 */
export function useFitScale(reserved = 0, max = 4): { ref: RefObject<HTMLDivElement | null>; scale: number } {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(2);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setScale(Math.max(1, Math.min(max, Math.floor(((node.clientHeight - reserved) * 0.9) / PLAYER_NATIVE.h))));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [reserved, max]);

  return { ref, scale };
}
