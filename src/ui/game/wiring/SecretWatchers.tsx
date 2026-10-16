'use client';
import { useEffect, useRef } from 'react';
import { useGame, useGameEvents } from '@/game/store';
import { useUi } from '../shared/uiStore';
import { fireSecret } from './fireSecret';

const SWAP_LIMIT = 20;
const SWAP_WINDOW_MS = 60_000;
const IDLE_MS = 60_000;
const CLOCK_CHECK_MS = 20_000;
const WALLPAPER_MS = 5 * 60_000;
const FITTING_LIMIT = 10;
const FITTING_WINDOW_MS = 60_000;
/** The balance that reads "404" on screen. */
const NOT_FOUND = 404;

/** Clock, swap, idle, balance, layout and event based secrets. The logo secret lives next to the logo. Renders nothing. */
export function SecretWatchers() {
  const lastClick = useRef(0);
  // The Super invasão of this session: its id and whether the player killed a bug by hand.
  const swarm = useRef<{ uid: number; byHand: boolean } | null>(null);

  // Playing between 3:00 and 5:00 local time, or on a Friday at 17:59.
  useEffect(() => {
    const check = () => {
      const now = new Date();
      const hour = now.getHours();
      if (hour >= 3 && hour < 5) fireSecret('night-owl');
      if (now.getDay() === 5 && hour === 17 && now.getMinutes() === 59) fireSecret('friday-deploy');
    };
    check();
    const timer = setInterval(check, CLOCK_CHECK_MS);
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

  // 10 skin changes within a minute.
  useEffect(() => {
    let stamps: number[] = [];
    let equipped = useGame.getState().state.equippedSkin;
    return useGame.subscribe((store) => {
      const next = store.state.equippedSkin;
      if (next === equipped) return;
      const changed = Object.keys(next).filter((id) => next[id as keyof typeof next] !== equipped[id as keyof typeof equipped]).length;
      equipped = next;
      if (changed === 0) return;
      const now = Date.now();
      stamps = [...stamps.filter((stamp) => now - stamp < FITTING_WINDOW_MS), ...Array.from({ length: changed }, () => now)];
      if (stamps.length >= FITTING_LIMIT) {
        stamps = [];
        fireSecret('fitting-room');
      }
    });
  }, []);

  // Exactly 404 whole ADScoins (what the balance shows).
  useEffect(() => {
    return useGame.subscribe((store) => {
      if (store.state.coins.floor().eq(NOT_FOUND)) fireSecret('error-404');
    });
  }, []);

  // Five minutes in a row with the side panel hidden.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = (open: boolean) => {
      clearTimeout(timer);
      timer = open ? undefined : setTimeout(() => fireSecret('wallpaper'), WALLPAPER_MS);
    };
    arm(useUi.getState().panelOpen);
    const stop = useUi.subscribe((ui, previous) => {
      if (ui.panelOpen !== previous.panelOpen) arm(ui.panelOpen);
    });
    return () => {
      stop();
      clearTimeout(timer);
    };
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

  useGameEvents(
    (event) => {
      switch (event.type) {
        case 'click':
          if (!event.auto) lastClick.current = Date.now();
          break;
        // Sold for less than it cost (a sale the market could not fully pay is not a loss).
        case 'bolsa':
          if (event.side === 'sell' && !event.capped && event.profit.lte(0)) fireSecret('lettuce-hands');
          break;
        case 'swarmStart':
          swarm.current = { uid: event.uid, byHand: false };
          break;
        case 'swarmHit':
          // Any click on a bug spoils it, kill or not; the bugs Wagner's Maestria defeats on its own do not.
          if (swarm.current?.uid === event.uid && !event.auto) swarm.current.byHand = true;
          break;
        case 'swarmEnd':
          if (swarm.current?.uid === event.uid && !swarm.current.byHand) fireSecret('hands-off');
          if (swarm.current?.uid === event.uid) swarm.current = null;
          break;
      }
    },
    ['click', 'bolsa', 'swarmStart', 'swarmHit', 'swarmEnd'],
  );

  return null;
}
