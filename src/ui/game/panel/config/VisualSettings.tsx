import { useGame } from '@/game/store';
import type { Settings } from '@/game/engine/state';
import { audio } from '@/ui/audio';
import { Button } from '@/ui/kit';
import { Section } from '../lib/Section';
import { ToggleRow } from './ToggleRow';

const MOTION_OPTIONS: { value: Settings['reducedMotion']; label: string }[] = [
  { value: 'system', label: 'Do sistema' },
  { value: 'off', label: 'Completa' },
  { value: 'on', label: 'Reduzida' },
];

/** Reduced motion and floating numbers. */
export function VisualSettings() {
  const reducedMotion = useGame((store) => store.state.settings.reducedMotion);
  const floatingNumbers = useGame((store) => store.state.settings.floatingNumbers);
  const updateSettings = useGame((store) => store.updateSettings);

  return (
    <Section title="Visual">
      <div className="setting-group">
        <div className="setting-row setting-row-stack">
          <span className="setting-text">
            <span className="setting-label">Animações</span>
            <span className="setting-hint">Reduzida desliga tremores, partículas e balanços</span>
          </span>
          <div className="setting-choice" role="group" aria-label="Animações">
            {MOTION_OPTIONS.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant="secondary"
                aria-pressed={reducedMotion === option.value}
                data-qa={`setting-motion-${option.value}`}
                onClick={() => {
                  audio.play('uiTap');
                  updateSettings({ reducedMotion: option.value });
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
        <ToggleRow
          label="Números flutuantes"
          hint="O +N que sobe a cada clique"
          checked={floatingNumbers}
          testId="setting-floating"
          onChange={(value) => updateSettings({ floatingNumbers: value })}
        />
      </div>
    </Section>
  );
}
