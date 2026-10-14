import type { CssVariables } from '@/ui/theme';

/**
 * The glow of each mythic skin. One entry per skin id: the colours tint the banded halo, the sparkles and the outline
 * around the professor on stage (MythicAura.tsx, mythic.css), the frame of the skin in the Álbum and the unlock
 * ceremony. A ninth mythic is one more entry here.
 */
export interface MythicEffect {
  /** Main colour: halo, outline, the frame in the Álbum and the ceremony on dark themes. Taken from the skin. */
  color: string;
  /** Second colour: the core of the halo and every third sparkle. */
  accent: string;
  /** Darker twin of `color`, for the frame on light themes. */
  ink: string;
}

export const MYTHIC_EFFECTS: Record<string, MythicEffect> = {
  'edecio-primordial': { color: '#ffc83d', accent: '#fff3b0', ink: '#a86b00' },
  'gladimir-robo': { color: '#38a8f0', accent: '#a8f0ff', ink: '#0b5f94' },
  'b2-prisma': { color: '#7fe6f5', accent: '#ffffff', ink: '#0e7490' },
  'wagner-sentinela': { color: '#ef3b3b', accent: '#ffa08a', ink: '#a31212' },
  'guto-tempestade': { color: '#4f86ff', accent: '#d2e2ff', ink: '#1e4cb5' },
  'b1-imperatriz': { color: '#8b4fe8', accent: '#fcd34d', ink: '#5b21b6' },
  'angelo-chanceler': { color: '#f7dc8a', accent: '#ffffff', ink: '#8a6a00' },
  'pablo-singularidade': { color: '#a855f7', accent: '#fb923c', ink: '#7a2bc0' },
};

/** The effect of a skin, or undefined when the skin has none (it is not mythic). */
export function mythicEffectOf(skinId: string): MythicEffect | undefined {
  return MYTHIC_EFFECTS[skinId];
}

/** The `--mythic` colour of a skin's frame and badge: the effect's colour, darker on light themes (the theme sets color-scheme). */
export function mythicFrameVariables(skinId: string): CssVariables | undefined {
  const effect = MYTHIC_EFFECTS[skinId];
  return effect ? ({ '--mythic': `light-dark(${effect.ink}, ${effect.color})` } as CssVariables) : undefined;
}

/** The `--fx` and `--fx2` colours of the glow on stage. */
export function mythicStageVariables(skinId: string): CssVariables | undefined {
  const effect = MYTHIC_EFFECTS[skinId];
  return effect ? ({ '--fx': effect.color, '--fx2': effect.accent } as CssVariables) : undefined;
}
