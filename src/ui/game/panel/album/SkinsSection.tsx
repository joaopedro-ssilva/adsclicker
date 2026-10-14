import { useCallback, useId, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { content, useGame } from '@/game/store';
import { PROFESSOR_IDS } from '@/game/content/types';
import type { ProfessorId, SkinDef } from '@/game/content/types';
import { Portrait } from '../lib/Portrait';
import { activeFilters, favouritesFirst, matches } from './albumFilters';
import { useCollapsedGroups } from './collapsedStore';
import { FilterBar, NoMatches } from './FilterBar';
import { useAlbumFilters } from './filterStore';
import { SkinCard } from './SkinCard';

const skinsByProfessor = PROFESSOR_IDS.map((id) => ({
  id,
  skins: content.skins.filter((skin) => skin.professor === id),
}));

const MYTHICS = content.skins.filter((skin) => skin.rarity === 'mythic');

/**
 * Skins grouped by professor, each list in rarity order (content order) with the favourites first. A group folds to
 * its header on a click. Professors not hired yet stay out of sight, so they are not spoiled.
 */
export function SkinsSection() {
  const owned = useGame((store) => store.state.skins);
  const favourites = useGame((store) => store.state.favourites);
  const equipped = useGame((store) => store.state.equippedSkin);
  const hired = useGame(useShallow((store) => PROFESSOR_IDS.filter((id) => store.state.hired[id])));
  const equipSkin = useGame((store) => store.equipSkin);
  const toggleFavourite = useGame((store) => store.toggleFavourite);
  const equip = useCallback((id: string) => equipSkin(id), [equipSkin]);
  const favourite = useCallback((id: string) => toggleFavourite('skin', id), [toggleFavourite]);
  const filters = useAlbumFilters((store) => store.filters.skins);

  const visible = skinsByProfessor.filter((group) => hired.includes(group.id));
  const hiddenCount = skinsByProfessor
    .filter((group) => !hired.includes(group.id))
    .reduce((sum, group) => sum + group.skins.length, 0);

  const groups = useMemo(
    () =>
      visible.map((group) => ({
        id: group.id,
        total: group.skins.length,
        have: group.skins.filter((skin) => owned[skin.id]).length,
        skins: favouritesFirst(
          group.skins.filter((skin) =>
            matches(
              {
                name: skin.name,
                professor: skin.professor,
                rarity: skin.rarity,
                owned: owned[skin.id] === true,
                favourite: favourites[`skin:${skin.id}`] === true,
              },
              filters,
            ),
          ),
          (skin) => favourites[`skin:${skin.id}`] === true,
        ),
      })),
    // `visible` follows `hired`, which is a stable shallow-compared array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hired, owned, favourites, filters],
  );

  const total = visible.reduce((sum, group) => sum + group.skins.length, 0);
  const shown = groups.reduce((sum, group) => sum + group.skins.length, 0);
  const haveAll = content.skins.filter((skin) => owned[skin.id]).length;
  const haveMythics = MYTHICS.filter((skin) => owned[skin.id]).length;
  const filtering = activeFilters(filters) > 0;

  return (
    <>
      <FilterBar section="skins" professors={hired} rarity noun={['skin', 'skins']} shown={shown} total={total} />
      <p className="panel-hint album-count">
        {haveAll}/{content.skins.length} skins na coleção. Desbloqueie as outras com conquistas. Míticas: {haveMythics}/{MYTHICS.length}.
      </p>
      <div className="album-groups">
        {shown === 0 ? <NoMatches section="skins" /> : null}
        {groups
          .filter((group) => group.skins.length > 0)
          .map((group) => (
            <SkinGroup
              key={group.id}
              professor={group.id}
              skins={group.skins}
              have={group.have}
              total={group.total}
              filtering={filtering}
              owned={owned}
              favourites={favourites}
              equipped={equipped[group.id]}
              onEquip={equip}
              onFavourite={favourite}
            />
          ))}
        {hiddenCount > 0 ? <p className="panel-hint">Contrate mais professores para ver as outras {hiddenCount} skins.</p> : null}
      </div>
    </>
  );
}

interface SkinGroupProps {
  professor: ProfessorId;
  skins: SkinDef[];
  have: number;
  total: number;
  /** While filtering, folded groups open so the results are not hidden. */
  filtering: boolean;
  owned: Record<string, boolean>;
  favourites: Record<string, boolean>;
  equipped: string | undefined;
  onEquip: (id: string) => void;
  onFavourite: (id: string) => void;
}

function SkinGroup({ professor, skins, have, total, filtering, owned, favourites, equipped, onEquip, onFavourite }: SkinGroupProps) {
  const folded = useCollapsedGroups((store) => store.collapsed[professor] === true);
  const collapsed = folded && !filtering;
  const toggle = useCollapsedGroups((store) => store.toggle);
  const gridId = useId();
  const name = content.professors[professor].name;
  return (
    <section className="album-group" data-collapsed={collapsed}>
      <h3 className="album-group-heading">
        <button
          type="button"
          className="album-group-head"
          aria-expanded={!collapsed}
          aria-controls={gridId}
          data-qa={`album-skins-${professor}`}
          onClick={() => toggle(professor)}
        >
          <Portrait professor={professor} />
          <span className="album-group-name">{name}</span>
          <span className="panel-section-note">
            {have}/{total}
          </span>
          <svg className="album-group-chevron" viewBox="0 0 8 4" width="16" height="8" shapeRendering="crispEdges" aria-hidden="true">
            <path d="M0 0h2v1H0zM6 0h2v1H6zM1 1h2v1H1zM5 1h2v1H5zM2 2h4v1H2zM3 3h2v1H3z" fill="currentColor" />
          </svg>
        </button>
      </h3>
      <div id={gridId} className="skin-grid" role="region" aria-label={`Skins de ${name}`} hidden={collapsed}>
        {collapsed
          ? null
          : skins.map((skin) => (
              <SkinCard
                key={skin.id}
                skin={skin}
                owned={owned[skin.id] === true}
                equipped={equipped === skin.id}
                favourite={favourites[`skin:${skin.id}`] === true}
                onEquip={onEquip}
                onFavourite={onFavourite}
              />
            ))}
      </div>
    </section>
  );
}
