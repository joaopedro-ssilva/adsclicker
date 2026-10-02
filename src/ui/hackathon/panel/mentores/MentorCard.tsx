import { memo } from 'react';
import { content as game } from '@/game/content';
import type { ProfessorId } from '@/game/content/types';
import type { MentorDef } from '@/hackathon/content';
import { mentorCost } from '@/hackathon/engine';
import { useHackathon } from '@/ui/hackathon/store';
import { Portrait } from '@/ui/game/panel/lib/Portrait';
import { Button, Icon } from '@/ui/kit';
import { cssVariables } from '@/ui/theme';
import { Commits } from '../lib/Commits';
import { HK } from '../lib/hk';
import { affixView, whole } from '../lib/labels';
import { useBusy } from '../lib/useBusy';
import { InlineError, useAction } from '../lib/useAction';

interface MentorCardProps {
  mentor: MentorDef;
  level: number;
  unlocked: boolean;
  commits: number;
}

const classroomPercent = Math.round(HK.config.mentorClassroomBonus * 100);

/** What one more level of this mentor gives in the Hackathon, as "+4% Lógica". */
function nextEffect(mentor: MentorDef): string {
  return mentor.modifiers
    .map((modifier) => {
      const view = affixView(modifier);
      return `${view.value} ${view.label}`;
    })
    .join(', ');
}

/** A professor as a mentor: level pips, what the next level gives here and in the classroom, and the buy button. */
export const MentorCard = memo(function MentorCard({ mentor, level, unlocked, commits }: MentorCardProps) {
  const { locked: busy } = useBusy();
  const { run: report, error } = useAction();
  const id: ProfessorId = mentor.professor;
  const professor = game.professors[id];
  const max = mentor.costs.length;
  const cost = mentorCost(id, level, HK);
  const maxed = cost === null;
  const missing = cost !== null ? cost - commits : 0;
  const reason = !unlocked ? null : maxed ? null : missing > 0 ? `Faltam ${whole(missing)} Commits` : null;
  const blocked = busy || reason !== null;

  return (
    <article className="hk-mentor hk-card" data-unlocked={unlocked} data-maxed={maxed} data-qa={`hk-mentor-${id}`} style={cssVariables({ '--mentor': professor.color })}>
      <div className="hk-mentor-portrait" data-locked={!unlocked}>
        <Portrait professor={id} zoom={1} />
        {!unlocked ? <Icon name="lock" size={24} className="hk-mentor-lock" /> : null}
      </div>
      <div className="hk-mentor-body">
        <header className="hk-mentor-head">
          <h3>{professor.name}</h3>
          <span className="hk-mentor-pips" role="img" aria-label={`Nível ${level} de ${max}`}>
            {Array.from({ length: max }, (_, index) => (
              <i key={index} data-on={index < level} />
            ))}
          </span>
        </header>
        <p className="hk-note hk-mentor-teaches">{mentor.teaches}</p>

        {!unlocked ? (
          <p className="hk-reason hk-mentor-locked">Contrate {professor.name} na sala de aula para liberar este mentor.</p>
        ) : (
          <>
            <ul className="hk-mentor-effects">
              <li>
                {maxed ? 'Hackathon: ' : 'Próximo nível: '}
                <strong>{maxed ? `${nextEffect(mentor)} (×${level})` : nextEffect(mentor)}</strong>
              </li>
              <li>
                Sala de aula: <strong>+{classroomPercent}% de ADScoins nas aulas deste professor</strong>
                {level > 0 ? ` (agora +${level * classroomPercent}%)` : ''}
              </li>
            </ul>
            <div className="hk-mentor-buy">
              <Button
                size="sm"
                variant={maxed ? 'secondary' : blocked ? 'secondary' : 'primary'}
                aria-disabled={blocked || maxed}
                data-qa={`hk-mentor-buy-${id}`}
                onClick={() => {
                  if (blocked || maxed) return;
                  void report(useHackathon.getState().buyMentor(id));
                }}
              >
                {maxed ? (
                  <>
                    <Icon name="check" size={12} />
                    Nível máximo
                  </>
                ) : (
                  <>
                    Subir para o nível {level + 1}
                    <Commits amount={cost ?? 0} />
                  </>
                )}
              </Button>
              {reason ? <span className="hk-reason">{reason}</span> : null}
              <InlineError message={error} />
            </div>
          </>
        )}
      </div>
    </article>
  );
});
