'use client';
import { useEffect } from 'react';
import { useHackathon } from '../store';

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName));
}

/** Space charges the Flow bar; 1 to 3 pick an upgrade between waves, and press the skills during the fight. */
export function useArenaKeys(): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
      // The dialogs of the game (scenes, modals) own the keyboard while open.
      if (document.querySelector('[aria-modal="true"]')) return;
      const store = useHackathon.getState();
      const run = store.run;
      if (!run) return;
      if (event.key === ' ') {
        event.preventDefault();
        if (!event.repeat) store.flowClick();
        return;
      }
      if (event.repeat) return;
      const slot = Number(event.key);
      if (!Number.isInteger(slot) || slot < 1) return;
      if (run.state.phase === 'choosing') {
        if (slot <= 3) store.choose((slot - 1) as 0 | 1 | 2);
      } else {
        const skill = run.state.skills[slot - 1];
        if (skill) store.useSkill(skill.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
