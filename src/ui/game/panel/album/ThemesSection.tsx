import { useCallback, useMemo } from 'react';
import { content, useGame } from '@/game/store';
import { favouritesFirst, matches } from './albumFilters';
import { FilterBar, NoMatches } from './FilterBar';
import { useAlbumFilters } from './filterStore';
import { ThemeCard } from './ThemeCard';

export function ThemesSection() {
  const owned = useGame((store) => store.state.themes);
  const favourites = useGame((store) => store.state.favourites);
  const equipped = useGame((store) => store.state.equippedTheme);
  const equipTheme = useGame((store) => store.equipTheme);
  const toggleFavourite = useGame((store) => store.toggleFavourite);
  const equip = useCallback((id: string) => equipTheme(id), [equipTheme]);
  const favourite = useCallback((id: string) => toggleFavourite('theme', id), [toggleFavourite]);
  const filters = useAlbumFilters((store) => store.filters.temas);

  const shown = useMemo(
    () =>
      favouritesFirst(
        content.themes.filter((theme) =>
          matches({ name: theme.name, owned: owned[theme.id] === true, favourite: favourites[`theme:${theme.id}`] === true }, filters),
        ),
        (theme) => favourites[`theme:${theme.id}`] === true,
      ),
    [owned, favourites, filters],
  );

  return (
    <>
      <FilterBar section="temas" noun={['tema', 'temas']} shown={shown.length} total={content.themes.length} />
      {shown.length === 0 ? <NoMatches section="temas" /> : null}
      <div className="theme-list">
        {shown.map((theme) => (
          <ThemeCard
            key={theme.id}
            theme={theme}
            owned={owned[theme.id] === true}
            equipped={equipped === theme.id}
            favourite={favourites[`theme:${theme.id}`] === true}
            onEquip={equip}
            onFavourite={favourite}
          />
        ))}
      </div>
    </>
  );
}
