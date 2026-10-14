import { describe, expect, it } from 'vitest';
import { content } from '@/game/content';
import { MYTHIC_EFFECTS, mythicEffectOf, mythicFrameVariables, mythicStageVariables } from './mythicEffects';

describe('mythic effects', () => {
  it('has exactly one effect per mythic skin, each of its own colour', () => {
    const mythics = content.skins.filter((skin) => skin.rarity === 'mythic').map((skin) => skin.id);
    expect(Object.keys(MYTHIC_EFFECTS).sort()).toEqual([...mythics].sort());
    const effects = Object.values(MYTHIC_EFFECTS);
    expect(new Set(effects.map((effect) => effect.color)).size).toBe(effects.length);
    for (const effect of effects) {
      for (const colour of [effect.color, effect.accent, effect.ink]) expect(colour).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('colours the frame and the stage glow of a mythic skin only', () => {
    expect(mythicEffectOf('gladimir-robo')?.color).toBe(MYTHIC_EFFECTS['gladimir-robo']?.color);
    expect(mythicEffectOf('edecio-default')).toBeUndefined();
    expect(mythicFrameVariables('edecio-default')).toBeUndefined();
    expect(mythicStageVariables('edecio-default')).toBeUndefined();
    expect(mythicFrameVariables('b2-prisma')?.['--mythic']).toContain('light-dark(');
    expect(mythicStageVariables('b2-prisma')?.['--fx']).toBe(MYTHIC_EFFECTS['b2-prisma']?.color);
  });
});
