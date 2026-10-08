'use client';
import { useState } from 'react';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { Window } from '../../screen/Window';
import { HK } from '../lib/hk';
import { ActiveSkills } from './ActiveSkills';
import { FreePoints } from './FreePoints';
import { NodeDetail } from './NodeDetail';
import { nodeView } from './nodeState';
import { RespecBlock } from './RespecBlock';
import { SkillTree } from './SkillTree';

/** The skill tree with the selected node beside it, the active skill slots under it and the respec. */
export function SkillsWindow({ profile }: { profile: HackathonProfile }) {
  const views = HK.skillNodes.map((node) => nodeView(node, profile));
  const [picked, setPicked] = useState<string | null>(null);
  const selected = views.find((view) => view.node.id === picked) ?? views.find((view) => view.state === 'ready') ?? views[0];

  return (
    <Window
      title="Habilidades"
      icon="star"
      size="xl"
      subtitle="Melhore suas habilidades e evolua como programador."
      aside={<FreePoints profile={profile} />}
      qa="hk-window-habilidades"
    >
      <div className="hk-panel hk-skills">
        <SkillTree profile={profile} selectedId={selected?.node.id ?? ''} onSelect={setPicked} />
        <div className="hk-skills-side">
          {selected ? <NodeDetail view={selected} /> : null}
          <RespecBlock profile={profile} />
        </div>
        <ActiveSkills profile={profile} />
      </div>
    </Window>
  );
}
