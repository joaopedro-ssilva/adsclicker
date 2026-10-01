export const soundNames = [
  'click',
  'crit',
  'buy',
  'cantAfford',
  'milestone',
  'achievement',
  'unlock',
  'hire',
  'invasionSpawn',
  'invasionHit',
  'invasionDefended',
  'invasionMissed',
  'ability',
  'sprintDone',
  'sprintFailed',
  'graduate',
  'uiTap',
] as const;

export type SoundName = (typeof soundNames)[number];

export interface SoundDef {
  /** MIDI note numbers played in sequence. */
  notes: readonly number[];
  /** Seconds between notes. */
  step: number;
  wave: OscillatorType;
  /** Seconds each note rings. Default 0.13. */
  length?: number;
  volume?: number;
  /** A quieter copy an octave lower, for a fatter sound. */
  layer?: OscillatorType;
  /** Seconds of filtered noise at the start (impacts). */
  noise?: number;
}

/** Everything is synthesised: there are no audio files. */
export const sounds: Record<SoundName, SoundDef> = {
  click: { notes: [76, 83], step: 0.025, wave: 'square', length: 0.045, volume: 0.1 },
  crit: { notes: [72, 79, 84, 91], step: 0.045, wave: 'square', layer: 'triangle', noise: 0.04 },
  buy: { notes: [60, 67, 72], step: 0.07, wave: 'triangle', layer: 'square', volume: 0.14 },
  cantAfford: { notes: [43, 39], step: 0.1, wave: 'sawtooth', length: 0.16, volume: 0.07 },
  milestone: { notes: [60, 64, 67, 72], step: 0.1, wave: 'square', layer: 'triangle' },
  achievement: { notes: [67, 72, 76, 79, 84], step: 0.11, wave: 'triangle', layer: 'square', length: 0.2 },
  unlock: { notes: [55, 62, 67, 74], step: 0.08, wave: 'triangle', layer: 'square' },
  hire: { notes: [60, 64, 67, 64, 72, 79], step: 0.12, wave: 'square', layer: 'triangle', length: 0.18 },
  invasionSpawn: { notes: [48, 61, 48, 61], step: 0.12, wave: 'sawtooth', volume: 0.08 },
  invasionHit: { notes: [50, 38], step: 0.025, wave: 'square', length: 0.07, noise: 0.05 },
  invasionDefended: { notes: [62, 69, 74, 78], step: 0.1, wave: 'square', layer: 'triangle' },
  invasionMissed: { notes: [57, 53, 50, 45], step: 0.13, wave: 'triangle', length: 0.2 },
  ability: { notes: [48, 60, 67, 72, 79, 84], step: 0.045, wave: 'sawtooth', volume: 0.08, noise: 0.06 },
  sprintDone: { notes: [72, 76, 79, 84], step: 0.09, wave: 'square', layer: 'triangle' },
  sprintFailed: { notes: [64, 62, 59, 55], step: 0.12, wave: 'triangle', length: 0.2 },
  graduate: { notes: [60, 64, 67, 72, 67, 72, 76, 79, 84], step: 0.17, wave: 'square', layer: 'triangle', length: 0.27 },
  uiTap: { notes: [81], step: 0.02, wave: 'triangle', length: 0.035, volume: 0.1 },
};

/** The background loop: a lead line (0 = rest) and a bass note every fourth step. */
export const melody = [72, 0, 79, 76, 0, 74, 72, 67, 69, 0, 76, 72, 0, 71, 67, 0, 72, 76, 79, 84, 0, 79, 76, 74, 69, 72, 71, 67, 0, 69, 71, 0];
export const bass = [48, 48, 45, 45, 53, 53, 55, 55];
export const STEP_SECONDS = 0.18;
