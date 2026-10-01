import { engine, type AudioVolumes } from './engine';
import type { SoundName } from './sounds';

export { soundNames, type SoundName } from './sounds';
export type { AudioVolumes } from './engine';

/**
 * Synthesised chiptune sound. Safe to call from anywhere on the client: nothing happens until the user has
 * interacted with the page, and the AudioContext is only created on that first gesture.
 */
export const audio = {
  /** Plays one sound effect. Ignored while muted or when the sfx volume is 0. */
  play: (name: SoundName): void => engine.play(name),
  /** Partial update. Volumes are 0..1. `muted` silences sfx and music without losing the volumes. */
  setVolumes: (volumes: Partial<AudioVolumes>): void => engine.setVolumes(volumes),
  /** Starts or stops the looping background track. Off by default. */
  setMusic: (on: boolean): void => engine.setMusic(on),
  /** Optional: prepare audio from a click handler. play() and setMusic() already do this lazily. */
  unlock: (): void => engine.unlock(),
  /** Stops everything and closes the AudioContext (for tests or a full teardown). */
  dispose: (): void => engine.dispose(),
};
