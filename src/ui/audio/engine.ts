import { bass, melody, STEP_SECONDS, sounds, type SoundName } from './sounds';

export interface AudioVolumes {
  sfx: number;
  music: number;
  muted: boolean;
}

const MAX_VOICES = 48;
const LOOKAHEAD = 0.14;
const SCHEDULER_MS = 50;

const clamp01 = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0);

/**
 * Chiptune synth on WebAudio. Nothing here runs at import time: the AudioContext is created lazily, and only
 * after the user has interacted with the page (browsers keep it suspended otherwise).
 */
class AudioEngine {
  private context: AudioContext | undefined;
  private sfxGain: GainNode | undefined;
  private musicGain: GainNode | undefined;
  private noiseBuffer: AudioBuffer | undefined;
  private volumes: AudioVolumes = { sfx: 0.55, music: 0.25, muted: false };
  private musicOn = false;
  private scheduler: ReturnType<typeof setInterval> | undefined;
  private nextNoteTime = 0;
  private step = 0;
  private readonly voices = new Set<OscillatorNode>();
  private readonly musicVoices = new Set<OscillatorNode>();
  private removeGestureListeners: (() => void) | undefined;
  private visibilityBound = false;

  play(name: SoundName): void {
    if (this.volumes.muted || this.volumes.sfx === 0) return;
    const context = this.ensureContext();
    const out = this.sfxGain;
    if (!context || !out) return;
    const sound = sounds[name];
    const volume = sound.volume ?? 0.12;
    const length = sound.length ?? 0.13;
    const start = context.currentTime + 0.005;
    sound.notes.forEach((midi, index) => {
      const when = start + index * sound.step;
      this.note(midi, when, length, sound.wave, out, volume);
      if (sound.layer) this.note(midi - 12, when, length, sound.layer, out, volume * 0.6);
    });
    if (sound.noise) this.noise(start, sound.noise, out, volume * 1.4);
  }

  setVolumes(next: Partial<AudioVolumes>): void {
    this.volumes = {
      sfx: next.sfx === undefined ? this.volumes.sfx : clamp01(next.sfx),
      music: next.music === undefined ? this.volumes.music : clamp01(next.music),
      muted: next.muted ?? this.volumes.muted,
    };
    this.applyGains();
    if (this.volumes.muted) this.stopMusic();
    else if (this.musicOn) this.startMusic();
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    this.applyGains();
    if (on) this.startMusic();
    else this.stopMusic();
  }

  /** Optional: call from a click handler to prepare audio before the first sound. play() and setMusic() do it anyway. */
  unlock(): void {
    this.ensureContext();
  }

  /** Stops everything and releases the AudioContext. */
  dispose(): void {
    this.stopMusic();
    this.removeGestureListeners?.();
    this.removeGestureListeners = undefined;
    this.voices.forEach((voice) => this.stopVoice(voice));
    this.voices.clear();
    if (this.context) void this.context.close();
    this.context = undefined;
    this.sfxGain = undefined;
    this.musicGain = undefined;
    this.noiseBuffer = undefined;
    this.musicOn = false;
  }

  private ensureContext(): AudioContext | undefined {
    if (typeof window === 'undefined' || !('AudioContext' in window)) return undefined;
    if (!this.context) {
      if (navigator.userActivation && !navigator.userActivation.hasBeenActive) {
        this.waitForGesture();
        return undefined;
      }
      this.create();
    }
    const context = this.context;
    if (context?.state === 'suspended') void context.resume().then(() => this.startMusic()).catch(() => undefined);
    else this.startMusic();
    return context;
  }

  private waitForGesture(): void {
    if (this.removeGestureListeners) return;
    const activate = () => {
      this.removeGestureListeners?.();
      this.removeGestureListeners = undefined;
      this.ensureContext();
    };
    window.addEventListener('pointerdown', activate, { once: true });
    window.addEventListener('keydown', activate, { once: true });
    this.removeGestureListeners = () => {
      window.removeEventListener('pointerdown', activate);
      window.removeEventListener('keydown', activate);
    };
  }

  private create(): void {
    const context = new window.AudioContext();
    const compressor = context.createDynamicsCompressor();
    compressor.connect(context.destination);
    this.sfxGain = context.createGain();
    this.musicGain = context.createGain();
    this.sfxGain.connect(compressor);
    this.musicGain.connect(compressor);
    this.context = context;
    this.applyGains();
    if (!this.visibilityBound) {
      this.visibilityBound = true;
      // Background tabs throttle timers, which would make the sequencer stutter: pause it instead.
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.stopMusic();
        else this.startMusic();
      });
    }
  }

  private applyGains(): void {
    const context = this.context;
    if (!context) return;
    this.sfxGain?.gain.setTargetAtTime(this.volumes.muted ? 0 : this.volumes.sfx, context.currentTime, 0.015);
    this.musicGain?.gain.setTargetAtTime(this.volumes.muted || !this.musicOn ? 0 : this.volumes.music, context.currentTime, 0.025);
  }

  private note(midi: number, when: number, length: number, wave: OscillatorType, out: GainNode, volume: number, isMusic = false): void {
    const context = this.context;
    if (!context || midi <= 0 || this.voices.size >= MAX_VOICES) return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = wave;
    oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    envelope.gain.setValueAtTime(0, when);
    envelope.gain.linearRampToValueAtTime(volume, when + 0.006);
    envelope.gain.exponentialRampToValueAtTime(0.0001, when + length);
    oscillator.connect(envelope);
    envelope.connect(out);
    this.voices.add(oscillator);
    if (isMusic) this.musicVoices.add(oscillator);
    oscillator.onended = () => {
      this.voices.delete(oscillator);
      this.musicVoices.delete(oscillator);
      oscillator.disconnect();
      envelope.disconnect();
    };
    oscillator.start(when);
    oscillator.stop(when + length + 0.02);
  }

  private noise(when: number, length: number, out: GainNode, volume: number): void {
    const context = this.context;
    if (!context) return;
    if (!this.noiseBuffer) {
      const buffer = context.createBuffer(1, Math.floor(context.sampleRate * 0.25), context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buffer;
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = 'bandpass';
    filter.frequency.value = 1800;
    envelope.gain.setValueAtTime(volume, when);
    envelope.gain.exponentialRampToValueAtTime(0.0001, when + length);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(out);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      envelope.disconnect();
    };
    source.start(when);
    source.stop(when + length + 0.02);
  }

  private stopVoice(voice: OscillatorNode): void {
    try {
      voice.stop();
    } catch {
      // A voice that already ended cannot be stopped again.
    }
  }

  private schedule = (): void => {
    const context = this.context;
    const out = this.musicGain;
    if (!context || !out || context.state !== 'running') return;
    if (this.nextNoteTime < context.currentTime) this.nextNoteTime = context.currentTime + 0.02;
    while (this.nextNoteTime < context.currentTime + LOOKAHEAD) {
      this.note(melody[this.step % melody.length] ?? 0, this.nextNoteTime, 0.14, 'square', out, 0.065, true);
      if (this.step % 4 === 0) this.note(bass[Math.floor(this.step / 4) % bass.length] ?? 48, this.nextNoteTime, 0.48, 'triangle', out, 0.15, true);
      this.step += 1;
      this.nextNoteTime += STEP_SECONDS;
    }
  };

  private startMusic(): void {
    const context = this.context;
    if (!context || !this.musicOn || this.volumes.muted || document.hidden || this.scheduler) return;
    this.nextNoteTime = context.currentTime + 0.02;
    this.schedule();
    this.scheduler = setInterval(this.schedule, SCHEDULER_MS);
  }

  private stopMusic(): void {
    clearInterval(this.scheduler);
    this.scheduler = undefined;
    this.musicVoices.forEach((voice) => this.stopVoice(voice));
    this.musicVoices.clear();
  }
}

export const engine = new AudioEngine();
