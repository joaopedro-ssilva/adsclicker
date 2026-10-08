'use client';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { Window } from '../../screen/Window';
import { HK } from '../lib/hk';
import { MentorCard } from './MentorCard';
import { MentorSummary } from './MentorSummary';

const share = Math.round(HK.config.mentorClassroomBonus * 100);

/** The 8 professors as mentors, all on screen under a summary of what they add up to. */
export function MentorsWindow({ profile }: { profile: HackathonProfile }) {
  return (
    <Window
      title="Mentores"
      icon="book"
      size="xl"
      subtitle={`Cada nível comprado com Commits fortalece o aluno aqui e soma ${share}% à produção do professor na sala de aula.`}
      qa="hk-window-mentores"
    >
      <div className="hk-panel hk-mentors-screen">
        <MentorSummary profile={profile} />
        <div className="hk-mentors">
          {HK.mentors.map((mentor) => {
            const state = profile.mentors[mentor.professor];
            return <MentorCard key={mentor.professor} mentor={mentor} level={state?.level ?? 0} unlocked={state?.unlocked ?? false} commits={profile.commits} />;
          })}
        </div>
      </div>
    </Window>
  );
}
