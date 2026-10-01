import { useGame } from '@/game/store';
import { audio } from '@/ui/audio';
import { Section } from '../lib/Section';
import { ToggleRow } from './ToggleRow';
import { VolumeRow } from './VolumeRow';

/** Volumes, mute and music. The game shell applies the settings to the audio engine; the calls here make the change instant. */
export function SoundSettings() {
  const sfxVolume = useGame((store) => store.state.settings.sfxVolume);
  const musicVolume = useGame((store) => store.state.settings.musicVolume);
  const muted = useGame((store) => store.state.settings.muted);
  const musicEnabled = useGame((store) => store.state.settings.musicEnabled);
  const updateSettings = useGame((store) => store.updateSettings);

  return (
    <Section title="Som">
      <div className="setting-group">
        <ToggleRow
          label="Silenciar tudo"
          checked={muted}
          testId="setting-muted"
          onChange={(value) => {
            audio.setVolumes({ muted: value });
            updateSettings({ muted: value });
          }}
        />
        <VolumeRow
          label="Efeitos"
          value={sfxVolume}
          disabled={muted}
          testId="setting-sfx"
          onChange={(value) => {
            audio.setVolumes({ sfx: value });
            updateSettings({ sfxVolume: value });
          }}
          onCommit={() => audio.play('buy')}
        />
        <ToggleRow
          label="Música de fundo"
          hint="Desligada por padrão"
          checked={musicEnabled}
          testId="setting-music"
          onChange={(value) => {
            audio.setMusic(value);
            updateSettings({ musicEnabled: value });
          }}
        />
        <VolumeRow
          label="Volume da música"
          value={musicVolume}
          disabled={muted || !musicEnabled}
          testId="setting-music-volume"
          onChange={(value) => {
            audio.setVolumes({ music: value });
            updateSettings({ musicVolume: value });
          }}
        />
      </div>
    </Section>
  );
}
