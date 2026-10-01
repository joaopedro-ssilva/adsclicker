'use client';
import { useEffect, useState } from 'react';
import { useGameState } from '@/game/store';

const NUDGE_UNTIL_CLICKS = 6;
const DELAY_MS = 1200;

/** The only tutorial: a small hint beside the professor that vanishes after the first clicks. */
export function FirstNudge() {
  const clicks = useGameState((state) => state.counters.clicks);
  const [late, setLate] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLate(true), DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  if (clicks >= NUDGE_UNTIL_CLICKS) return null;
  return (
    <p className="nudge" data-show={late} aria-hidden="true">
      <span className="nudge-arrow">◀</span> Clique no professor
    </p>
  );
}
