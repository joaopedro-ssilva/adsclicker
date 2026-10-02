'use client';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { AlunoTab } from '../panel/aluno/AlunoTab';
import { Window } from '../screen/Window';
import { useHackathonUi } from '../screen/uiStore';

/** Placeholder hub: the student tab in a window until the real hub lands. */
export function HubView({ profile }: { profile: HackathonProfile }) {
  const openItem = useHackathonUi((store) => store.openItem);
  return (
    <Window title="Aluno" icon="crown" size="md">
      <div className="hk-panel">
        <AlunoTab profile={profile} onOpenItem={openItem} />
      </div>
    </Window>
  );
}
