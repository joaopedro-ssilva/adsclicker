import { describe, expect, it } from 'vitest';
import { content } from '@/game/content';
import { MYTHIC_EFFECTS, mythicEffectOf, mythicFrameVariables, pixelShadow } from './mythicEffects';

describe('mythic effects', () => {
  it('has exactly one effect per mythic skin, each of its own kind and colour', () => {
    const mythics = content.skins.filter((skin) => skin.rarity === 'mythic').map((skin) => skin.id);
    expect(Object.keys(MYTHIC_EFFECTS).sort()).toEqual([...mythics].sort());
    const effects = Object.values(MYTHIC_EFFECTS);
    expect(new Set(effects.map((effect) => effect.kind)).size).toBe(effects.length);
    expect(new Set(effects.map((effect) => effect.color)).size).toBe(effects.length);
    for (const effect of effects) {
      for (const colour of [effect.color, effect.accent, effect.ink]) expect(colour).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('colours the frame of a mythic skin only', () => {
    expect(mythicEffectOf('gladimir-robo')?.kind).toBe('scan');
    expect(mythicEffectOf('edecio-default')).toBeUndefined();
    expect(mythicFrameVariables('edecio-default')).toBeUndefined();
    expect(mythicFrameVariables('b2-prisma')?.['--mythic']).toContain('light-dark(');
  });

  it('draws a pixel sprite as one shadow per filled cell, starting one cell off the element', () => {
    expect(pixelShadow(['o.', '.x'], { o: 'red', x: 'blue' }, 3)).toBe('3px 3px 0 red, 6px 6px 0 blue');
  });
});
