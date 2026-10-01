'use client';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { audio } from '@/ui/audio';
import { fx } from '@/ui/fx';
import { useMoments } from '../moments/momentsStore';

const STORAGE_KEY = 'adsclicker.ui.layers';

function readSeen(): Record<string, boolean> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function markSeen(layer: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readSeen(), [layer]: true }));
  } catch {
    // Without storage the flourish simply plays again next time.
  }
}

export function forgetLayers(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing to forget
  }
}

interface LayerRevealProps {
  /** Stable name of the game layer. The first time it ever appears it arrives with a flourish. */
  layer: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * Wraps a piece of HUD that belongs to an unlockable layer. Its first appearance (remembered in
 * localStorage, outside the save) pops in with sparkles once no ceremony is covering the screen.
 */
export function LayerReveal({ layer, className, style, children }: LayerRevealProps) {
  const node = useRef<HTMLDivElement>(null);
  const [fresh] = useState(() => !readSeen()[layer]);
  const [phase, setPhase] = useState<'wait' | 'play' | 'done'>(fresh ? 'wait' : 'done');
  const covered = useMoments((store) => store.queue.length > 0);

  useEffect(() => {
    if (phase !== 'wait' || covered) return;
    const timer = setTimeout(() => {
      markSeen(layer);
      setPhase('play');
      const rect = node.current?.getBoundingClientRect();
      if (rect) fx.sparkles({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, count: 36 });
      audio.play('uiTap');
    }, 350);
    return () => clearTimeout(timer);
  }, [phase, covered, layer]);

  return (
    <div ref={node} className={className} style={style} data-reveal={phase}>
      {children}
    </div>
  );
}
