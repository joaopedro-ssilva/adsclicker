import type { CSSProperties } from 'react';
import type { ThemeDef } from '@/game/content/types';

export type CssVariables = CSSProperties & { [name: `--${string}`]: string };
export type ColorScheme = 'dark' | 'light';

const DARK_INK = '#0e0f14';
const LIGHT_INK = '#ffffff';

/** Parses #rgb and #rrggbb. Returns undefined for any other CSS colour syntax. */
export function parseHex(color: string): [number, number, number] | undefined {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!match?.[1]) return undefined;
  const hex = match[1].length === 3 ? [...match[1]].map((digit) => digit + digit).join('') : match[1];
  const value = Number.parseInt(hex, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function luminance([red, green, blue]: [number, number, number]): number {
  const linear = (channel: number) => {
    const unit = channel / 255;
    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

function contrast(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Dark themes keep the default status colours; light ones switch to the darker set in tokens.css. */
export function colorScheme(theme?: ThemeDef): ColorScheme {
  const rgb = theme ? parseHex(theme.colors.bg) : undefined;
  return rgb && luminance(rgb) > 0.4 ? 'light' : 'dark';
}

/** The text colour (dark or white) that reads best on top of the accent. */
export function readableOn(color: string): string {
  const rgb = parseHex(color);
  if (!rgb) return DARK_INK;
  const accent = luminance(rgb);
  return contrast(accent, luminance(parseHex(DARK_INK) ?? [0, 0, 0])) >= contrast(accent, 1) ? DARK_INK : LIGHT_INK;
}

/**
 * CSS variables for a theme and an accent colour. ThemeProvider applies them on its wrapper;
 * use this directly to tint another element (for example a portal root).
 */
export function themeVariables(theme?: ThemeDef, accent?: string): CssVariables {
  const variables: CssVariables = {};
  if (theme) {
    const { bg, surface, surfaceRaised, border, text, textMuted } = theme.colors;
    variables['--bg'] = bg;
    variables['--surface'] = surface;
    variables['--surface-raised'] = surfaceRaised;
    variables['--border'] = border;
    variables['--text'] = text;
    variables['--text-muted'] = textMuted;
  }
  if (accent) {
    variables['--accent'] = accent;
    variables['--on-accent'] = readableOn(accent);
  }
  return variables;
}

/** Builds a style object that sets CSS custom properties, which React's CSSProperties type does not accept inline. */
export function cssVariables(variables: Record<`--${string}`, string>): CssVariables {
  return variables as CssVariables;
}
