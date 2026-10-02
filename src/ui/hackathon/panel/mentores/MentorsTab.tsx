import type { HackathonProfile } from '@/shared/hackathonApi';
import { HK } from '../lib/hk';
import { num } from '../lib/labels';
import { MentorCard } from './MentorCard';

/** The 8 professors as mentors, under a header with what they add up to in the classroom. */
export function MentorsTab({ profile }: { profile: HackathonProfile }) {
  const levels = HK.mentors.reduce((sum, mentor) => sum + (profile.mentors[mentor.professor]?.level ?? 0), 0);
  const maxLevels = HK.mentors.reduce((sum, mentor) => sum + mentor.costs.length, 0);
  const share = Math.round(HK.config.mentorClassroomBonus * 100);
  const cargoBonus = HK.cargos.find((cargo) => cargo.id === profile.cargo)?.classroomMultiplier ?? 1;

  return (
    <>
      <header className="hk-card hk-mentors-head" data-tone="accent" data-qa="hk-mentors-head">
        <div>
          <h2>Mentores</h2>
          <p className="hk-note">
            Cada nível comprado com Commits fortalece o aluno aqui e soma {share}% à produção do professor na sala de aula.
          </p>
        </div>
        <dl>
          <div>
            <dt>Níveis</dt>
            <dd>
              {levels}/{maxLevels}
            </dd>
          </div>
          <div>
            <dt>Mentores na sala</dt>
            <dd>+{levels * share}%</dd>
          </div>
          <div>
            <dt>Cargo</dt>
            <dd>×{num(cargoBonus, 2)}</dd>
          </div>
        </dl>
      </header>
      <div className="hk-mentors">
        {HK.mentors.map((mentor) => {
          const state = profile.mentors[mentor.professor];
          return <MentorCard key={mentor.professor} mentor={mentor} level={state?.level ?? 0} unlocked={state?.unlocked ?? false} commits={profile.commits} />;
        })}
      </div>
    </>
  );
}
