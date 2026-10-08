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

/** What one level of this mentor gives in the Hackathon, as "+4% Lógica". */
function levelEffect(mentor: MentorDef, levels: number): string {
  return mentor.modifiers
    .map((modifier) => {
      const view = affixView({ ...modifier, value: modifier.value * levels });
      return `${view.value} ${view.label}`;
    })
    .join(', ');
}

/** The professor's own line: the text before the "Cada nível: ..." sentence, which the effect rows already say. */
function quoteOf(mentor: MentorDef): string {
  const cut = mentor.teaches.indexOf(' Cada nível');
  return (cut > 0 ? mentor.teaches.slice(0, cut) : mentor.teaches).trim();
}

/** A professor as a mentor: level pips, the quote, what the next level gives here and in the classroom, and the buy button. */
export const MentorCard = memo(function MentorCard({ mentor, level, unlocked, commits }: MentorCardProps) {
  const { locked: busy } = useBusy();
  const { run: report, error } = useAction();
  const id: ProfessorId = mentor.professor;
  const professor = game.professors[id];
  const max = mentor.costs.length;
  const cost = mentorCost(id, level, HK);
  const maxed = cost === null;
  const missing = cost !== null ? cost - commits : 0;
  const blocked = busy || missing > 0;

  return (
    <article className="hk-mentor" data-unlocked={unlocked} data-maxed={maxed} data-qa={`hk-mentor-${id}`} style={cssVariables({ '--mentor': professor.color })}>
      <header className="hk-mentor-head">
        <div className="hk-mentor-portrait" data-locked={!unlocked}>
          <Portrait professor={id} zoom={1} />
          {!unlocked ? <Icon name="lock" size={24} className="hk-mentor-lock" /> : null}
        </div>
        <div className="hk-mentor-id">
          <h3>{professor.name}</h3>
          <span className="hk-mentor-pips" role="img" aria-label={`Nível ${level} de ${max}`}>
            {Array.from({ length: max }, (_, index) => (
              <i key={index} data-on={index < level} />
            ))}
          </span>
          <span className="hk-mentor-level">{maxed ? 'Nível máximo' : `Nível ${level}`}</span>
        </div>
      </header>
      <p className="hk-mentor-quote">“{quoteOf(mentor)}”</p>

      {!unlocked ? (
        <p className="hk-reason hk-mentor-locked">Contrate {professor.name} na sala de aula para liberar este mentor.</p>
      ) : (
        <>
          <dl className="hk-mentor-effects">
            <div>
              <dt>Aluno</dt>
              <dd>{maxed ? `${levelEffect(mentor, level)} (total)` : levelEffect(mentor, 1)}</dd>
            </div>
            <div title="Cada nível soma à produção das aulas deste professor">
              <dt>Sala</dt>
              <dd>
                +{classroomPercent}% ADScoins{level > 0 ? ` (agora +${level * classroomPercent}%)` : ''}
              </dd>
            </div>
          </dl>
          <footer className="hk-mentor-buy">
            {!maxed ? (
              <p className="hk-mentor-cost">
                Custo <Commits amount={cost} size={14} />
              </p>
            ) : null}
            <Button
              size="sm"
              variant={maxed || blocked ? 'secondary' : 'primary'}
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
                <>Subir para o nível {level + 1}</>
              )}
            </Button>
            {missing > 0 && !maxed ? <p className="hk-reason">Faltam {whole(missing)} Commits</p> : null}
            <InlineError message={error} />
          </footer>
        </>
      )}
    </article>
  );
});
