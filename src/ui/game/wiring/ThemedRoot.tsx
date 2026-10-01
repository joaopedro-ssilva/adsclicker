'use client';
import type { ReactNode } from 'react';
import { content, useGameState } from '@/game/store';
import { ThemeProvider } from '@/ui/ThemeProvider';

const themesById = new Map(content.themes.map((theme) => [theme.id, theme]));

/** Equipped theme for the base colours, the professor on stage for the accent, and the reduced-motion setting. */
export function ThemedRoot({ children }: { children: ReactNode }) {
  const themeId = useGameState((state) => state.equippedTheme);
  const active = useGameState((state) => state.activeProfessor);
  const reducedMotion = useGameState((state) => state.settings.reducedMotion);

  return (
    <ThemeProvider
      theme={themesById.get(themeId)}
      accent={content.professors[active].color}
      reducedMotion={reducedMotion === 'on'}
    >
      {children}
    </ThemeProvider>
  );
}
