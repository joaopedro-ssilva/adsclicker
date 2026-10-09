'use client';
import { useEffect } from 'react';
import { formatDuration } from '@/game/engine/format';
import { useFestaView } from '@/game/store';
import { fx } from '@/ui/fx';
import { useReducedMotion } from '@/ui/useReducedMotion';
import { anchorPoint } from '../../wiring/stageRefs';

const CONFETTI_EVERY_MS = 1100;

/** The party on the stage: coloured lights, a frame, a banner with the time left, and confetti every second or so. */
export function FestaLayer() {
  const view = useFestaView();
  const reduced = useReducedMotion();
  const active = view?.active ?? null;
  const running = active !== null;

  useEffect(() => {
    if (!running || reduced) return;
    const timer = setInterval(() => {
      const point = anchorPoint('stage', 0.25 + Math.random() * 0.4);
      fx.confetti({ x: point.x + (Math.random() - 0.5) * 360, y: point.y, count: 28 });
    }, CONFETTI_EVERY_MS);
    return () => clearInterval(timer);
  }, [running, reduced]);

  if (!active) return null;
  return (
    <div className="festa-layer" data-qa="festa-layer" aria-hidden="true">
      <div className="festa-lights" />
      <div className="festa-frame" />
      <div className="festa-banner">
        🎉 Festa de lançamento {formatDuration(active.leftMs)}
        <i>
          <b style={{ width: `${(active.leftMs / active.totalMs) * 100}%` }} />
        </i>
      </div>
    </div>
  );
}
