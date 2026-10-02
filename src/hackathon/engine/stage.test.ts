import { describe, expect, it } from 'vitest';
import { resolveStage } from './index';
import { fixtureContent as content } from './__fixtures__/content';

describe('resolveStage', () => {
  it('resolves a campaign stage as is and returns null for unknown ids', () => {
    const stage = resolveStage('s3', '2026-10-02', content);
    expect(stage).toMatchObject({ id: 's3', level: 3, boss: false, modifiers: [] });
    expect(stage?.waves).toEqual(content.stages[2]?.waves);
    expect(resolveStage('nope', '2026-10-02', content)).toBeNull();
  });

  it('does not share arrays with the content', () => {
    const stage = resolveStage('s1', '2026-10-02', content);
    stage?.waves[0]?.push('x');
    expect(content.stages[0]?.waves[0]).toEqual(['grunt']);
  });
});

describe('daily stage', () => {
  const daily = (date: string) => resolveStage('daily', date, content);

  it('is the same for a date, whoever asks', () => {
    expect(daily('2026-10-02')).toEqual(daily('2026-10-02'));
  });

  it('differs across dates', () => {
    const keys = new Set<string>();
    for (let day = 1; day <= 20; day += 1) keys.add(JSON.stringify(daily(`2026-10-${String(day).padStart(2, '0')}`)));
    expect(keys.size).toBeGreaterThan(10);
  });

  it('follows the generation rules', () => {
    for (let day = 1; day <= 30; day += 1) {
      const stage = daily(`2026-11-${String(day).padStart(2, '0')}`);
      expect(stage).not.toBeNull();
      if (!stage) continue;
      expect(stage.id).toBe('daily');
      expect(stage.waves).toHaveLength(content.config.daily.waves);
      expect(stage.waves[stage.waves.length - 1]?.[0]).toBe('timed'); // the toughest common by HP
      for (const wave of stage.waves.slice(0, -1)) {
        expect(wave.length).toBeGreaterThanOrEqual(1);
        expect(wave.length).toBeLessThanOrEqual(2);
        expect(wave.every((id) => id !== 'boss')).toBe(true);
      }
      expect(stage.waves.flat()).not.toContain('boss');
      expect(stage.modifiers).toHaveLength(content.config.daily.modifiers);
      expect(new Set(stage.modifiers.map((m) => m.id)).size).toBe(stage.modifiers.length);
      expect(stage.level).toBe(2); // mean of the regular stages' levels 1, 2, 3
      expect(stage.drops.length).toBeLessThanOrEqual(4);
      expect(new Set(stage.drops).size).toBe(stage.drops.length);
      expect(stage.drops.every((id) => content.items.some((i) => i.id === id))).toBe(true);
      expect(stage.xp).toBeGreaterThan(0);
    }
  });

  it('is null when the content has no enemies', () => {
    expect(resolveStage('daily', '2026-10-02', { ...content, enemies: [] })).toBeNull();
  });
});
