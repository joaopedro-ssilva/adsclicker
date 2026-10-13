'use client';
import { useEffect, useState } from 'react';
import { useGame } from '@/game/store';
import { useHackathon } from '@/ui/hackathon/store';

const LOADED_BUILD = process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev';
const CHECK_EVERY_MS = 5 * 60_000;

async function liveBuild(): Promise<string | null> {
  try {
    const response = await fetch('/api/version', { cache: 'no-store' });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    return body && typeof body === 'object' && 'build' in body && typeof body.build === 'string' ? body.build : null;
  } catch {
    return null;
  }
}

function reload() {
  // The save is local first: write it now, and the reload boots from it (time away counts as offline time).
  useGame.getState().save();
  window.location.reload();
}

/**
 * Notices a deploy while the game is open: checks the live build every few minutes and when the tab comes back.
 * A newer build reloads the page by itself the next time the tab is hidden (nobody is looking), and meanwhile a
 * small bar offers to update now. After the reload the patch announcement shows like on any other visit.
 * In development (no build id) it does nothing.
 */
export function UpdateWatcher() {
  const [outdated, setOutdated] = useState(false);

  useEffect(() => {
    if (LOADED_BUILD === 'dev') return;
    let stale = false;
    const check = async () => {
      if (stale) return;
      const live = await liveBuild();
      if (live && live !== 'dev' && live !== LOADED_BUILD) {
        stale = true;
        setOutdated(true);
      }
    };
    const onVisibility = () => {
      // Never in the middle of a Hackathon stage: that one waits for the button or the next visit.
      if (document.visibilityState === 'hidden' && stale && useHackathon.getState().mode !== 'hackathon') reload();
      else if (document.visibilityState === 'visible') void check();
    };
    const timer = setInterval(() => void check(), CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  if (!outdated) return null;
  return (
    <div className="update-note" role="status" data-qa="update-note">
      <span>Saiu uma atualização com novidades!</span>
      <button type="button" onClick={reload}>
        Atualizar agora
      </button>
    </div>
  );
}
