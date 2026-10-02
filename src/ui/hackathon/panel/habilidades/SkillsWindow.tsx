'use client';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { Window } from '../../screen/Window';
import { SkillsTab } from './SkillsTab';

/** The skill tree screen. */
export function SkillsWindow({ profile }: { profile: HackathonProfile }) {
  return (
    <Window title="Habilidades" icon="star" size="md" qa="hk-window-habilidades">
      <div className="hk-panel">
        <SkillsTab profile={profile} />
      </div>
    </Window>
  );
}
