import { content } from '@/game/content';
import type { ProfessorId, Rarity } from '@/game/content/types';
import { audio } from '@/ui/audio';
import { Button, Icon } from '@/ui/kit';
import { activeFilters } from './albumFilters';
import { useAlbumFilters } from './filterStore';
import type { FilteredSection } from './filterStore';

const RARITY_LABELS: Record<Rarity, string> = { common: 'Comum', rare: 'Rara', epic: 'Épica', legendary: 'Lendária', mythic: 'Mítica' };

interface FilterBarProps {
  section: FilteredSection;
  /** Professors offered in the professor filter (skins only; omit for the other sections). */
  professors?: ProfessorId[];
  /** Offer the rarity filter (skins only). */
  rarity?: boolean;
  /** Singular and plural of what is listed, for the count. */
  noun: [string, string];
  shown: number;
  total: number;
}

/** Search, selects and toggles that narrow one Album section. Sticks under the section switch. */
export function FilterBar({ section, professors, rarity = false, noun, shown, total }: FilterBarProps) {
  const filters = useAlbumFilters((store) => store.filters[section]);
  const setFilter = useAlbumFilters((store) => store.set);
  const clear = useAlbumFilters((store) => store.clear);
  const active = activeFilters(filters);

  return (
    <div className="album-filters" role="search" aria-label="Filtrar o álbum" data-qa={`album-filters-${section}`}>
      <div className="album-filters-row">
        <input
          type="search"
          className="album-filter-field album-filter-search"
          placeholder="Buscar pelo nome"
          aria-label="Buscar pelo nome"
          maxLength={40}
          value={filters.query}
          onChange={(event) => setFilter(section, { query: event.target.value })}
        />
        {professors ? (
          <select
            className="album-filter-field"
            aria-label="Professor"
            value={filters.professor}
            onChange={(event) => setFilter(section, { professor: event.target.value as ProfessorId | 'all' })}
          >
            <option value="all">Todos os professores</option>
            {professors.map((id) => (
              <option key={id} value={id}>
                {content.professors[id].name}
              </option>
            ))}
          </select>
        ) : null}
        {rarity ? (
          <select
            className="album-filter-field"
            aria-label="Raridade"
            value={filters.rarity}
            onChange={(event) => setFilter(section, { rarity: event.target.value as Rarity | 'all' })}
          >
            <option value="all">Todas as raridades</option>
            {(Object.keys(RARITY_LABELS) as Rarity[]).map((id) => (
              <option key={id} value={id}>
                {RARITY_LABELS[id]}
              </option>
            ))}
          </select>
        ) : null}
        <select
          className="album-filter-field"
          aria-label="Coleção"
          value={filters.ownership}
          onChange={(event) => setFilter(section, { ownership: event.target.value as 'all' | 'owned' | 'missing' })}
        >
          <option value="all">Tenho e faltam</option>
          <option value="owned">Só as que tenho</option>
          <option value="missing">Só as que faltam</option>
        </select>
        <Button
          size="sm"
          variant="secondary"
          className="album-filter-fav"
          aria-pressed={filters.favouritesOnly}
          data-qa="album-filter-favourites"
          onClick={() => {
            audio.play('uiTap');
            setFilter(section, { favouritesOnly: !filters.favouritesOnly });
          }}
        >
          <Icon name="star" size={12} />
          Favoritas
        </Button>
      </div>
      <div className="album-filters-foot">
        <span className="album-filters-count" aria-live="polite">
          {shown === total ? `${total} ${total === 1 ? noun[0] : noun[1]}` : `${shown} de ${total} ${noun[1]}`}
        </span>
        {active > 0 ? (
          <button type="button" className="album-filters-clear" data-qa="album-filter-clear" onClick={() => clear(section)}>
            limpar ({active})
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Shown in place of a section when the filters leave nothing. */
export function NoMatches({ section }: { section: FilteredSection }) {
  const clear = useAlbumFilters((store) => store.clear);
  return (
    <div className="album-no-matches" data-qa="album-no-matches">
      <p>Nada por aqui com esses filtros. A coleção está bem, os filtros é que estão exigentes.</p>
      <Button size="sm" variant="secondary" onClick={() => clear(section)}>
        Limpar filtros
      </Button>
    </div>
  );
}
