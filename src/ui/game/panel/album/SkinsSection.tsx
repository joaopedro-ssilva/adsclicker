import { useCallback, useId } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { content, useGame } from '@/game/store';
import { PROFESSOR_IDS } from '@/game/content/types';
import type { ProfessorId, SkinDef } from '@/game/content/types';
import { Portrait } from '../lib/Portrait';
import { useCollapsedGroups } from './collapsedStore';
import { SkinCard } from './SkinCard';

const skinsByProfessor = PROFESSOR_IDS.map((id) => ({
  id,
  skins: content.skins.filter((skin) => skin.professor === id),
}));

/**
 * Skins grouped by professor, each list in rarity order (content order). A group folds to its header on a click.
 * Professors not hired yet stay out of sight, so they are not spoiled.
 */
export function SkinsSection() {
  const owned = useGame((store) => store.state.skins);
  const equipped = useGame((store) => store.state.equippedSkin);
  const hired = useGame(useShallow((store) => PROFESSOR_IDS.filter((id) => store.state.hired[id])));
  const equipSkin = useGame((store) => store.equipSkin);
  const equip = useCallback((id: string) => equipSkin(id), [equipSkin]);

  const visible = skinsByProfessor.filter((group) => hired.includes(group.id));
  const hiddenCount = skinsByProfessor
    .filter((group) => !hired.includes(group.id))
    .reduce((sum, group) => sum + group.skins.length, 0);

  return (
    <div className="album-groups">
      {visible.map((group) => (
        <SkinGroup
          key={group.id}
          professor={group.id}
          skins={group.skins}
          owned={owned}
          equipped={equipped[group.id]}
          onEquip={equip}
        />
      ))}
      {hiddenCount > 0 ? <p className="panel-hint">Contrate mais professores para ver as outras {hiddenCount} skins.</p> : null}
    </div>
  );
}

interface SkinGroupProps {
  professor: ProfessorId;
  skins: SkinDef[];
  owned: Record<string, boolean>;
  equipped: string | undefined;
  onEquip: (id: string) => void;
}

function SkinGroup({ professor, skins, owned, equipped, onEquip }: SkinGroupProps) {
  const have = skins.filter((skin) => owned[skin.id]).length;
  const collapsed = useCollapsedGroups((store) => store.collapsed[professor] === true);
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
            {have}/{skins.length}
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
                onEquip={onEquip}
              />
            ))}
      </div>
    </section>
  );
}
