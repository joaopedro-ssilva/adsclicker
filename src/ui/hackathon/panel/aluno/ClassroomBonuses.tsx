import { content as game } from '@/game/content';
import type { ProfessorId } from '@/game/content/types';
import { classroomBonus } from '@/hackathon/engine';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { HK } from '../lib/hk';
import { num } from '../lib/labels';

/** What this student gives back to the classroom: the cargo multiplier and each mentor's share. */
export function ClassroomBonuses({ profile }: { profile: HackathonProfile }) {
  const levels: Partial<Record<ProfessorId, number>> = {};
  for (const [id, mentor] of Object.entries(profile.mentors)) levels[id as ProfessorId] = mentor.level;
  const bonus = classroomBonus({ cargo: profile.cargo, mentors: levels }, HK);
  const mentors = HK.mentors.flatMap((mentor) => {
    const multiplier = bonus.mentors[mentor.professor];
    return multiplier ? [{ id: mentor.professor, multiplier }] : [];
  });

  return (
    <div className="hk-card hk-classroom" data-qa="hk-classroom">
      <p className="hk-classroom-main">
        <span>ADScoins na sala de aula</span>
        <b>×{num(bonus.cargo, 2)}</b>
      </p>
      {mentors.length === 0 ? (
        <p className="hk-note">Compre níveis de mentor para aumentar a produção de cada professor na sala.</p>
      ) : (
        <ul>
          {mentors.map(({ id, multiplier }) => (
            <li key={id}>
              <span>{game.professors[id].name}</span>
              <b>+{num((multiplier - 1) * 100, 0)}% de produção</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
