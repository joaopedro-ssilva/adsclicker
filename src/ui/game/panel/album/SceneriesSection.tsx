import { useCallback, useMemo } from 'react';
import { content, useGame } from '@/game/store';
import { favouritesFirst, matches } from './albumFilters';
import { FilterBar, NoMatches } from './FilterBar';
import { useAlbumFilters } from './filterStore';
import { SceneryCard } from './SceneryCard';

export function SceneriesSection() {
  const owned = useGame((store) => store.state.sceneries);
  const favourites = useGame((store) => store.state.favourites);
  const equipped = useGame((store) => store.state.equippedScenery);
  const equipScenery = useGame((store) => store.equipScenery);
  const toggleFavourite = useGame((store) => store.toggleFavourite);
  const equip = useCallback((id: string) => equipScenery(id), [equipScenery]);
  const favourite = useCallback((id: string) => toggleFavourite('scenery', id), [toggleFavourite]);
  const filters = useAlbumFilters((store) => store.filters.cenarios);

  const shown = useMemo(
    () =>
      favouritesFirst(
        content.sceneries.filter((scenery) =>
          matches(
            { name: scenery.name, owned: owned[scenery.id] === true, favourite: favourites[`scenery:${scenery.id}`] === true },
            filters,
          ),
        ),
        (scenery) => favourites[`scenery:${scenery.id}`] === true,
      ),
    [owned, favourites, filters],
  );

  return (
    <>
      <FilterBar section="cenarios" noun={['cenário', 'cenários']} shown={shown.length} total={content.sceneries.length} />
      {shown.length === 0 ? <NoMatches section="cenarios" /> : null}
      <div className="album-scenery-grid">
        {shown.map((scenery) => (
          <SceneryCard
            key={scenery.id}
            scenery={scenery}
            owned={owned[scenery.id] === true}
            equipped={equipped === scenery.id}
            favourite={favourites[`scenery:${scenery.id}`] === true}
            onEquip={equip}
            onFavourite={favourite}
          />
        ))}
      </div>
    </>
  );
}
