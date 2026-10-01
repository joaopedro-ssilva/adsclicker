'use client';
import { useEffect, useState } from 'react';
import { audio, soundNames } from '@/ui/audio';
import { Button, Icon, Panel } from '@/ui/kit';
import { soundLabels } from '../data';
import { SectionHeading } from '../parts/SectionHeading';

export function AudioSection() {
  const [music, setMusic] = useState(false);
  const [muted, setMuted] = useState(false);
  const [sfx, setSfx] = useState(0.55);
  const [musicVolume, setMusicVolume] = useState(0.25);

  // The showcase page must not leave a track playing behind when you navigate away.
  useEffect(() => () => audio.setMusic(false), []);

  return (
    <section className="kit-section" aria-labelledby="som">
      <SectionHeading id="som" number="07" title="O som do semestre" note="Dezessete efeitos sintetizados, sem nenhum arquivo de áudio." />
      <div className="sound-layout">
        <Panel>
          <div className="sound-grid">
            {soundNames.map((sound, index) => (
              <Button key={sound} variant="secondary" size="sm" className="sound-button" onClick={() => audio.play(sound)}>
                <span className="sound-index" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {soundLabels[sound]}
              </Button>
            ))}
          </div>
        </Panel>

        <Panel className="music-panel">
          <div className="row">
            <Icon name="music" className="accent-icon" />
            <h3>Plantão de 8 bits</h3>
          </div>
          <Button
            variant={music ? 'primary' : 'secondary'}
            aria-pressed={music}
            onClick={() => {
              const next = !music;
              setMusic(next);
              audio.setMusic(next);
            }}
          >
            <Icon name={music ? 'soundOn' : 'soundOff'} />
            {music ? 'Pausar música' : 'Tocar música'}
          </Button>
          <label className="slider-field">
            <span>Volume dos efeitos</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={sfx}
              onChange={(event) => {
                const volume = Number(event.target.value);
                setSfx(volume);
                audio.setVolumes({ sfx: volume });
              }}
            />
          </label>
          <label className="slider-field">
            <span>Volume da música</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={musicVolume}
              onChange={(event) => {
                const volume = Number(event.target.value);
                setMusicVolume(volume);
                audio.setVolumes({ music: volume });
              }}
            />
          </label>
          <label className="toggle-field">
            Silenciar tudo
            <input
              type="checkbox"
              checked={muted}
              onChange={(event) => {
                setMuted(event.target.checked);
                audio.setVolumes({ muted: event.target.checked });
              }}
            />
          </label>
        </Panel>
      </div>
    </section>
  );
}
