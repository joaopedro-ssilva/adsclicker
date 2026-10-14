import { describe, expect, it } from 'vitest';
import { matchShortcut, SHORTCUTS, shortcutKey } from './shortcutList';

const press = (key: string, extra: { code?: string; shiftKey?: boolean } = {}) =>
  matchShortcut({ key, code: extra.code ?? '', shiftKey: extra.shiftKey ?? false });

describe('shortcuts', () => {
  it('gives every shortcut its own key', () => {
    const keys = SHORTCUTS.map((shortcut) => shortcut.key.toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('matches letters in either case and digits for the abilities', () => {
    expect(press('r')?.id).toBe('rollforward');
    expect(press('R')?.id).toBe('rollforward');
    expect(press('2')?.id).toBe('ability-2');
    expect(press('Escape')?.id).toBe('leave-photo');
    expect(shortcutKey('photo')).toBe('C');
  });

  it('reads Shift+digit from the physical key and keeps plain digits for the abilities', () => {
    expect(press('!', { code: 'Digit1', shiftKey: true })?.id).toBe('tab-aulas');
    expect(press('^', { code: 'Digit6', shiftKey: true })?.id).toBe('tab-config');
    expect(press('1', { code: 'Digit1' })?.id).toBe('ability-1');
  });

  it('ignores keys with no shortcut', () => {
    expect(press('x')).toBeNull();
    expect(press(' ')).toBeNull();
    expect(press('Enter')).toBeNull();
  });
});
