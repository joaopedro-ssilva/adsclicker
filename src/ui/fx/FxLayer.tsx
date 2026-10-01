'use client';
import { useEffect, useImperativeHandle, useMemo, useRef, type Ref } from 'react';
import { useReducedMotion } from '../useReducedMotion';
import { FxEngine } from './engine';
import { registerFx } from './fx';
import type { FxHandle } from './types';

export interface FxLayerProps {
  /** Imperative handle. The global `fx` object reaches the same layer, so the ref is optional. */
  ref?: Ref<FxHandle>;
}

/**
 * One full-screen, click-through canvas for floating numbers, coin bursts, sparkles, confetti and screen shake.
 * Mount it once, outside any transformed element. Coordinates are viewport pixels (MouseEvent.clientX/Y).
 * With reduced motion, numbers fade in place and every other effect is skipped.
 */
export function FxLayer({ ref }: FxLayerProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<FxEngine | undefined>(undefined);
  const reduced = useReducedMotion();

  const handle = useMemo<FxHandle>(
    () => ({
      floatingNumber: (options) => engine.current?.floatingNumber(options),
      coins: (options) => engine.current?.coins(options),
      sparkles: (options) => engine.current?.sparkles(options),
      confetti: (options) => engine.current?.confetti(options),
      shake: (options) => engine.current?.shake(options),
      clear: () => engine.current?.clear(),
    }),
    [],
  );
  useImperativeHandle(ref, () => handle, [handle]);

  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const created = new FxEngine(node, reduced);
    engine.current = created;
    const unregister = registerFx(handle);
    return () => {
      unregister();
      created.destroy();
      if (engine.current === created) engine.current = undefined;
    };
  }, [reduced, handle]);

  return <canvas ref={canvas} className="fx-canvas" aria-hidden="true" />;
}
