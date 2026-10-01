'use client';
import { useGameEvents } from '@/game/store';
import { DevMultiplierSync } from './DevMultiplierSync';
import { handleGameEvent } from './handleGameEvent';
import { SecretWatchers } from './SecretWatchers';
import { useAudioSettings } from './useAudioSettings';

/** The single subscriber to game events, plus the audio and secret watchers. Renders nothing. */
export function GameEffects() {
  useAudioSettings();
  useGameEvents(handleGameEvent);
  return (
    <>
      <SecretWatchers />
      <DevMultiplierSync />
    </>
  );
}
