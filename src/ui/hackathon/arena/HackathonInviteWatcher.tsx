'use client';
import { useEffect } from 'react';
import { useMoments } from '@/ui/game/moments/momentsStore';
import { useHackathonUnlocked } from './useHackathonUnlocked';

const SEEN_KEY = 'adsclicker.hackathon-invite';

function alreadySeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) !== null;
  } catch {
    return true; // without storage the scene could repeat on every load: better to skip it
  }
}

/** Queues the Hackathon invitation scene the first time the mode is unlocked on this device. Renders nothing. */
export function HackathonInviteWatcher() {
  const unlocked = useHackathonUnlocked();

  useEffect(() => {
    if (!unlocked || alreadySeen()) return;
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      return;
    }
    // After the hire scene, which the same event queued a moment ago.
    useMoments.getState().push({ kind: 'hackathon' });
  }, [unlocked]);

  return null;
}
