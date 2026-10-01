'use client';
import type { ReactNode } from 'react';
import type { ThemeDef } from '@/game/content/types';
import { colorScheme, themeVariables } from './theme';
import { ReducedMotionContext, useReducedMotion } from './useReducedMotion';

export { useReducedMotion };
export { themeVariables } from './theme';

export interface ThemeProviderProps {
  /** Base colours. Omit to keep the default dark theme. */
  theme?: ThemeDef;
  /** Accent colour (hex), normally `ProfessorDef.color` of the professor on stage. */
  accent?: string;
  /** The game's "reduce motion" setting. The OS preference is always honoured on top of it. */
  reducedMotion?: boolean;
  className?: string;
  children: ReactNode;
}

/** Applies a theme and an accent by setting CSS variables on a wrapper element. */
export function ThemeProvider({ theme, accent, reducedMotion = false, className, children }: ThemeProviderProps) {
  const system = useReducedMotion();
  const reduced = reducedMotion || system;

  return (
    <ReducedMotionContext value={reduced}>
      <div
        className={className ? `ui-theme ${className}` : 'ui-theme'}
        style={themeVariables(theme, accent)}
        data-scheme={colorScheme(theme)}
        data-reduced-motion={reduced}
      >
        {children}
      </div>
    </ReducedMotionContext>
  );
}
