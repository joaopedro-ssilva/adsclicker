'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { ResolvedStage } from '@/hackathon/engine';
import { pickScale } from './arenaLayout';

/**
 * The integer sprite zoom that fits the student and the widest wave of the stage in the box of `ref`. It depends on
 * the stage, not on the wave being fought, so nothing grows or shrinks in the middle of a fight.
 */
export function useArenaScale(stage: Pick<ResolvedStage, 'waves'>): { ref: RefObject<HTMLDivElement | null>; scale: number } {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(3);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setScale(pickScale({ width: node.clientWidth, height: node.clientHeight }, stage));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [stage]);

  return { ref, scale };
}
