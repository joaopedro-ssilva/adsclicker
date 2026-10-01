import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { content, useGame } from '@/game/store';
import { PROFESSOR_IDS } from '@/game/content/types';
import type { ProfessorId, SkinDef } from '@/game/content/types';
import { Portrait } from '../lib/Portrait';
import { SkinCard } from './SkinCard';

const skinsByProfessor = PROFESSOR_IDS.map((id) => ({
  id,
  skins: content.skins.filter((skin) => skin.professor === id),
}));

/** Skins grouped by professor. Professors not hired yet stay out of sight, so they are not spoiled. */
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
  return (
    <section className="album-group">
      <header className="album-group-head">
        <Portrait professor={professor} />
        <h3>{content.professors[professor].name}</h3>
        <span className="panel-section-note">
          {have}/{skins.length}
        </span>
      </header>
      <div className="skin-grid">
        {skins.map((skin) => (
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
