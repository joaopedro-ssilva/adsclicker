'use client';
import { content } from '@/game/content';
import type { ProfessorId } from '@/game/content/types';
import { audio } from '@/ui/audio';
import { Button, Icon, ProgressBar, toast } from '@/ui/kit';

const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

/** Three discipline rows from the real content: two buyable, one locked ("???"). */
export function LessonRows({ professorId }: { professorId: ProfessorId }) {
  const lessons = content.disciplines.filter((discipline) => discipline.professor === professorId).slice(0, 3);

  return (
    <div className="lesson-list">
      {lessons.map((lesson, index) => {
        const locked = index === 2;
        return (
          <div className="lesson-row" key={lesson.id} data-locked={locked}>
            <span className="lesson-icon" aria-hidden="true">
              {locked ? <Icon name="lock" /> : lesson.emoji}
            </span>
            <div className="lesson-text">
              <h3>{locked ? '???' : lesson.name}</h3>
              <p>
                {locked
                  ? 'Chegue ao nível 10 da aula anterior'
                  : `Nível ${12 - index * 5} · custa ${compact.format(Number(lesson.baseCost))}`}
              </p>
              {locked ? null : (
                <ProgressBar value={6 - index * 3} max={10} ariaLabel="Rumo ao próximo marco" size="sm" segmented segments={10} />
              )}
            </div>
            <Button
              size="sm"
              variant={index === 0 ? 'primary' : 'secondary'}
              disabled={locked}
              onClick={() => {
                audio.play('buy');
                toast({ title: 'Muito legal!', description: `${lesson.name} subiu de nível.`, emoji: lesson.emoji, tone: 'good' });
              }}
            >
              <Icon name="plus" />1 nível
            </Button>
          </div>
        );
      })}
    </div>
  );
}
