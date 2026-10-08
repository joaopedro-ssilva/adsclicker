'use client';
import { useEffect, useRef } from 'react';
import { useGame, useGameEvents } from '@/game/store';
import { fireSecret } from './fireSecret';

const SWAP_LIMIT = 20;
const SWAP_WINDOW_MS = 60_000;
const IDLE_MS = 60_000;
const NIGHT_OWL_CHECK_MS = 60_000;

/** Clock, swap and idle based secrets. The logo secret lives next to the logo. Renders nothing. */
export function SecretWatchers() {
  const lastClick = useRef(0);

  // Playing between 3:00 and 5:00 local time.
  useEffect(() => {
    const check = () => {
      const hour = new Date().getHours();
      if (hour >= 3 && hour < 5) fireSecret('night-owl');
    };
    check();
    const timer = setInterval(check, NIGHT_OWL_CHECK_MS);
    return () => clearInterval(timer);
  }, []);

  // 20 swaps of the professor on stage within a minute, from the roster or the panel.
  useEffect(() => {
    let swaps: number[] = [];
    let active = useGame.getState().state.activeProfessor;
    return useGame.subscribe((store) => {
      if (store.state.activeProfessor === active) return;
      active = store.state.activeProfessor;
      const now = Date.now();
      swaps = [...swaps.filter((stamp) => now - stamp < SWAP_WINDOW_MS), now];
      if (swaps.length >= SWAP_LIMIT) {
        swaps = [];
        fireSecret('swap-spree');
      }
    });
  }, []);

  // A minute with the game open, visible and no click by the player (auto clicks do not count).
  useEffect(() => {
    lastClick.current = Date.now();
    const timer = setInterval(() => {
      if (document.hidden) {
        lastClick.current = Date.now();
      } else if (Date.now() - lastClick.current >= IDLE_MS) {
        lastClick.current = Date.now();
        fireSecret('idle-watcher');
      }
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useGameEvents((event) => {
    if (event.type === 'click' && !event.auto) lastClick.current = Date.now();
  }, ['click']);

  return null;
}
