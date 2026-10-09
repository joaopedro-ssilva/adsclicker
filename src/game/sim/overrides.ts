import type { GameContent } from '../content/types';

/**
 * Applies `path=json` overrides (separated by `;`) to a copy of the content, for balance experiments
 * from the command line: `balance.graduation.base="4e19";professors.wagner.hireCost="2e12"`.
 * Array indexes are plain numbers in the path (`maestrias.releases.bonus.0=0.03`). Returns the content itself with no overrides.
 */
export function applyOverrides(content: GameContent, spec: string | undefined): GameContent {
  if (!spec || spec === 'true') return content;
  const copy = structuredClone(content) as unknown as Record<string, unknown>;
  for (const part of spec.split(';')) {
    const at = part.indexOf('=');
    if (at < 0) continue;
    const keys = part.slice(0, at).trim().split('.');
    const value: unknown = JSON.parse(part.slice(at + 1));
    let node = copy;
    for (const key of keys.slice(0, -1)) node = node[key] as Record<string, unknown>;
    node[keys[keys.length - 1] ?? ''] = value;
  }
  return copy as unknown as GameContent;
}
