import type { HackathonProfile } from '@/shared/hackathonApi';
import { HK } from '../lib/hk';
import { num } from '../lib/labels';

/** Levels bought, what the mentors add up to in the classroom, and the cargo multiplier. */
export function MentorSummary({ profile }: { profile: HackathonProfile }) {
  const levels = HK.mentors.reduce((sum, mentor) => sum + (profile.mentors[mentor.professor]?.level ?? 0), 0);
  const maxLevels = HK.mentors.reduce((sum, mentor) => sum + mentor.costs.length, 0);
  const share = Math.round(HK.config.mentorClassroomBonus * 100);
  const cargoBonus = HK.cargos.find((cargo) => cargo.id === profile.cargo)?.classroomMultiplier ?? 1;

  return (
    <dl className="hk-mentors-head" data-qa="hk-mentors-head">
      <div>
        <dt>Níveis</dt>
        <dd>
          {levels}/{maxLevels}
        </dd>
      </div>
      <div>
        <dt>Bônus na sala</dt>
        <dd>+{levels * share}%</dd>
      </div>
      <div>
        <dt>Cargo</dt>
        <dd>×{num(cargoBonus, 2)}</dd>
      </div>
    </dl>
  );
}
