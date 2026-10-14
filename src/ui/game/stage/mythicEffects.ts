import type { CssVariables } from '@/ui/theme';

/**
 * The on-stage effect of each mythic skin. One entry per skin id: `kind` picks the drawing in MythicAura.tsx and the
 * colours tint it, the frame of the skin in the Álbum and the unlock ceremony. A ninth mythic is one more entry here
 * (and, if it wants a look of its own, one more kind in MythicAura.tsx and mythic.css).
 */
export type MythicKind = 'sunburst' | 'scan' | 'prism' | 'shield' | 'storm' | 'constellation' | 'laurel' | 'singularity';

export interface MythicEffect {
  kind: MythicKind;
  /** Main colour: the effect itself, the frame in the Álbum and the ceremony on dark themes. */
  color: string;
  /** Second colour of the effect. */
  accent: string;
  /** Darker twin of `color`, for the frame on light themes. */
  ink: string;
}

export const MYTHIC_EFFECTS: Record<string, MythicEffect> = {
  'edecio-primordial': { kind: 'sunburst', color: '#ffc83d', accent: '#fff3b0', ink: '#a86b00' },
  'gladimir-robo': { kind: 'scan', color: '#38bdf8', accent: '#5eead4', ink: '#0b6a9a' },
  'b2-prisma': { kind: 'prism', color: '#c084fc', accent: '#ffffff', ink: '#7e22ce' },
  'wagner-sentinela': { kind: 'shield', color: '#ef4444', accent: '#ff9a8a', ink: '#a31212' },
  'guto-tempestade': { kind: 'storm', color: '#fde047', accent: '#7c8bb0', ink: '#8a6d00' },
  'b1-imperatriz': { kind: 'constellation', color: '#a78bfa', accent: '#fde68a', ink: '#5b21b6' },
  'angelo-chanceler': { kind: 'laurel', color: '#f5c542', accent: '#fff8e1', ink: '#8a6a00' },
  'pablo-singularidade': { kind: 'singularity', color: '#fb923c', accent: '#8b5cf6', ink: '#a8460a' },
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

/**
 * A pixel drawing as a `box-shadow` list: one shadow per filled cell, so a single empty element of `unit` pixels
 * becomes a sprite with hard edges. `.` and any character outside the palette are empty. The drawing starts one cell
 * down and to the right of the element, because a shadow is never painted under its own box.
 */
export function pixelShadow(rows: readonly string[], palette: Readonly<Record<string, string>>, unit: number): string {
  const cells: string[] = [];
  rows.forEach((row, y) => {
    [...row].forEach((char, x) => {
      const color = palette[char];
      if (color) cells.push(`${(x + 1) * unit}px ${(y + 1) * unit}px 0 ${color}`);
    });
  });
  return cells.join(', ');
}
