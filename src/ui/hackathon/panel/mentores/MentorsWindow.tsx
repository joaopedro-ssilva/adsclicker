'use client';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { Window } from '../../screen/Window';
import { MentorsTab } from './MentorsTab';

/** The mentors screen. */
export function MentorsWindow({ profile }: { profile: HackathonProfile }) {
  return (
    <Window title="Mentores" icon="book" size="md" qa="hk-window-mentores">
      <div className="hk-panel">
        <MentorsTab profile={profile} />
      </div>
    </Window>
  );
}
