import { memo } from 'react';
import type { ThemeDef } from '@/game/content/types';
import { audio } from '@/ui/audio';
import { Button, Icon } from '@/ui/kit';
import { cssVariables } from '@/ui/theme';
import { unlockHint } from './albumData';

interface ThemeCardProps {
  theme: ThemeDef;
  owned: boolean;
  equipped: boolean;
  onEquip: (id: string) => void;
}

/** A HUD theme with a miniature of its own colours. */
export const ThemeCard = memo(function ThemeCard({ theme, owned, equipped, onEquip }: ThemeCardProps) {
  const { bg, surface, surfaceRaised, border, text, textMuted } = theme.colors;
  return (
    <article className="theme-card" data-owned={owned} data-equipped={equipped}>
      <div
        className="theme-card-preview"
        data-locked={!owned}
        style={cssVariables({
          '--t-bg': bg,
          '--t-surface': surface,
          '--t-raised': surfaceRaised,
          '--t-border': border,
          '--t-text': text,
          '--t-muted': textMuted,
        })}
        aria-hidden="true"
      >
        <span className="theme-card-title">Aa</span>
        <span className="theme-card-bar" />
        <span className="theme-card-chip" />
        <span className="theme-card-line" />
        {!owned ? <Icon name="lock" size={24} className="theme-card-lock" /> : null}
      </div>
      <div className="theme-card-text">
        <h3>{owned ? theme.name : '???'}</h3>
        {owned ? <p>{theme.description}</p> : <p className="skin-card-hint">{unlockHint('theme', theme.id)}</p>}
      </div>
      {owned ? (
        <Button
          size="sm"
          variant={equipped ? 'secondary' : 'primary'}
          aria-pressed={equipped}
          data-qa={`theme-${theme.id}`}
          onClick={() => {
            if (equipped) return;
            audio.play('uiTap');
            onEquip(theme.id);
          }}
        >
          {equipped ? (
            <>
              <Icon name="check" size={12} />
              Em uso
            </>
          ) : (
            'Aplicar'
          )}
        </Button>
      ) : null}
    </article>
  );
});
