import { describe, expect, it } from 'vitest';
import { favouriteKey, toggleFavourite } from './favourites';
import { deserializeState, serializeState } from './save';
import { newCleanGame, T0 } from './__fixtures__/helpers';

describe('favourites', () => {
  it('stars and unstars only what is owned and exists', () => {
    const g = newCleanGame();
    expect(toggleFavourite(g.state, g.content, 'skin', 'edecio-cafe')).toBe(false); // not owned
    expect(toggleFavourite(g.state, g.content, 'skin', 'ghost')).toBe(false);
    expect(g.state.favourites).toEqual({});

    expect(toggleFavourite(g.state, g.content, 'skin', 'edecio-default')).toBe(true);
    expect(toggleFavourite(g.state, g.content, 'scenery', 'sala')).toBe(true);
    expect(toggleFavourite(g.state, g.content, 'theme', 'escuro')).toBe(true);
    expect(g.state.favourites[favouriteKey('skin', 'edecio-default')]).toBe(true);

    expect(toggleFavourite(g.state, g.content, 'skin', 'edecio-default')).toBe(true);
    expect(g.state.favourites[favouriteKey('skin', 'edecio-default')]).toBeUndefined();
  });

  it('survives a save round trip', () => {
    const g = newCleanGame();
    toggleFavourite(g.state, g.content, 'skin', 'edecio-default');
    toggleFavourite(g.state, g.content, 'theme', 'escuro');
    const loaded = deserializeState(serializeState(g.state), g.content, T0)!;
    expect(loaded.favourites).toEqual(g.state.favourites);
  });

  it('loads an old save without the field, and drops unknown or unowned ids', () => {
    const g = newCleanGame();
    const raw = JSON.parse(serializeState(g.state));
    delete raw.favourites;
    expect(deserializeState(JSON.stringify(raw), g.content, T0)!.favourites).toEqual({});

    raw.favourites = {
      'skin:edecio-default': true,
      'skin:edecio-cafe': true, // exists, not owned
      'skin:ghost': true,
      'scenery:sala': 'yes', // not a boolean true
      'theme:escuro': true,
      nonsense: true,
    };
    const loaded = deserializeState(JSON.stringify(raw), g.content, T0)!;
    expect(loaded.favourites).toEqual({ 'skin:edecio-default': true, 'theme:escuro': true });

    raw.favourites = 'broken';
    expect(deserializeState(JSON.stringify(raw), g.content, T0)!.favourites).toEqual({});
  });
});
