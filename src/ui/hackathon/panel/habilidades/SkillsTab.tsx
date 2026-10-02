import { useState } from 'react';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { Section } from '@/ui/game/panel/lib/Section';
import { HK } from '../lib/hk';
import { ActiveSkills } from './ActiveSkills';
import { NodeDetail } from './NodeDetail';
import { nodeView } from './nodeState';
import { RespecBlock } from './RespecBlock';
import { SkillTree } from './SkillTree';

/** Skill points, the tree with its node detail, the active skills and the respec. */
export function SkillsTab({ profile }: { profile: HackathonProfile }) {
  const views = HK.skillNodes.map((node) => nodeView(node, profile));
  const [picked, setPicked] = useState<string | null>(null);
  const fallback = views.find((view) => view.state === 'ready') ?? views[0];
  const selected = views.find((view) => view.node.id === picked) ?? fallback;
  const total = profile.level - 1;

  return (
    <>
      <div className="hk-points" data-qa="hk-points" data-has={profile.freeSkillPoints > 0}>
        <span className="hk-points-number">{profile.freeSkillPoints}</span>
        <span className="hk-points-text">
          <strong>{profile.freeSkillPoints === 1 ? 'ponto livre' : 'pontos livres'}</strong>
          <small>
            {total - profile.freeSkillPoints} de {total} gastos · 1 ponto por nível
          </small>
        </span>
      </div>
      <SkillTree profile={profile} selectedId={selected?.node.id ?? ''} onSelect={setPicked} />
      {selected ? <NodeDetail view={selected} /> : null}
      <Section title="Habilidades ativas">
        <ActiveSkills profile={profile} />
      </Section>
      <RespecBlock profile={profile} />
    </>
  );
}
