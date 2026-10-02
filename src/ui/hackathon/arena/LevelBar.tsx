'use client';
import { useEffect, useState } from 'react';
import { audio } from '@/ui/audio';
import { fx } from '@/ui/fx';
import type { LevelSegment } from '../shared/levelSegments';

interface LevelBarProps {
  segments: LevelSegment[];
  /** Starts the animation. */
  active: boolean;
  /** Skip to the final state. */
  instant: boolean;
}

interface View {
  level: number;
  fill: number;
  smooth: boolean;
  /** Just levelled up: flashes the label. */
  up: boolean;
}

const STEP_MS = 850;

/** The student's XP bar after the fight: it fills, overflows into the next level and keeps going. */
export function LevelBar({ segments, active, instant }: LevelBarProps) {
  const first = segments[0];
  const last = segments[segments.length - 1];
  const [animated, setView] = useState<View>({ level: first?.level ?? 1, fill: first?.from ?? 0, smooth: false, up: false });

  const view: View = instant && last ? { level: last.level, fill: last.to, smooth: false, up: false } : animated;

  useEffect(() => {
    if (!active || !first || !last) return;
    if (instant) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    segments.forEach((segment, index) => {
      const start = index * STEP_MS;
      timers.push(setTimeout(() => setView({ level: segment.level, fill: segment.from, smooth: false, up: index > 0 }), start));
      timers.push(setTimeout(() => setView((current) => ({ ...current, fill: segment.to, smooth: true })), start + 80));
      if (index > 0) {
        timers.push(
          setTimeout(() => {
            audio.play('milestone');
            fx.sparkles({ x: window.innerWidth * 0.5, y: window.innerHeight * 0.4, count: 30, color: '#f7ca75' });
          }, start),
        );
      }
    });
    return () => timers.forEach(clearTimeout);
  }, [active, instant, segments, first, last]);

  return (
    <div className="ar-levelbar" data-up={view.up}>
      <p className="ar-levelbar-label">
        <span>Nível {view.level}</span>
        {view.up ? <b className="ar-levelup">NÍVEL ACIMA!</b> : null}
      </p>
      <div
        className="ar-levelbar-track"
        role="progressbar"
        aria-label="Experiência"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(view.fill * 100)}
      >
        <i style={{ width: `${view.fill * 100}%`, transition: view.smooth ? `width ${STEP_MS - 150}ms steps(14)` : 'none' }} />
      </div>
    </div>
  );
}
