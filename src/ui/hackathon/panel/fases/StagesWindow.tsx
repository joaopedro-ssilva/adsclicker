'use client';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { Window } from '../../screen/Window';
import { StagesTab } from './StagesTab';

/** The stages screen. */
export function StagesWindow({ profile }: { profile: HackathonProfile }) {
  return (
    <Window title="Fases" icon="rocket" size="md" qa="hk-window-fases">
      <div className="hk-panel">
        <StagesTab profile={profile} />
      </div>
    </Window>
  );
}
