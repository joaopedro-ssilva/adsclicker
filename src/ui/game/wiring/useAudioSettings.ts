'use client';
import { useEffect } from 'react';
import { useGameState } from '@/game/store';
import { audio } from '@/ui/audio';

/** Keeps the synth in step with the player's volume, mute and music settings. */
export function useAudioSettings(): void {
  const sfx = useGameState((state) => state.settings.sfxVolume);
  const music = useGameState((state) => state.settings.musicVolume);
  const muted = useGameState((state) => state.settings.muted);
  const musicEnabled = useGameState((state) => state.settings.musicEnabled);

  useEffect(() => {
    audio.setVolumes({ sfx, music, muted });
  }, [sfx, music, muted]);

  useEffect(() => {
    audio.setMusic(musicEnabled);
  }, [musicEnabled]);
}
