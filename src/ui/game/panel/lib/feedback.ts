import { audio } from '@/ui/audio';
import type { SoundName } from '@/ui/audio';

const lastPlayed = new Map<SoundName, number>();

/** Plays a sound at most once per `gapMs`, so a held button repeating a purchase does not turn into a buzz. */
export function playLimited(name: SoundName, gapMs = 70): void {
  const now = performance.now();
  if (now - (lastPlayed.get(name) ?? -Infinity) < gapMs) return;
  lastPlayed.set(name, now);
  audio.play(name);
}

const SHAKE = [
  { transform: 'translateX(0)' },
  { transform: 'translateX(-4px)' },
  { transform: 'translateX(4px)' },
  { transform: 'translateX(-3px)' },
  { transform: 'translateX(2px)' },
  { transform: 'translateX(0)' },
];

/** A short "no" wiggle for a button that cannot be used. The caller decides whether motion is allowed. */
export function shake(element: HTMLElement, reduced: boolean): void {
  if (reduced) return;
  element.animate(SHAKE, { duration: 260, easing: 'steps(6, end)' });
}
