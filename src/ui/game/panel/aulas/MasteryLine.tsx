import { useShallow } from 'zustand/react/shallow';
import { content, useGame } from '@/game/store';
import { masteryView } from '@/game/engine/views';
import type { ProfessorId } from '@/game/content/types';
import { PostdocDefence } from './PostdocDefence';

/**
 * The professor's Domínio: rank, a thin bar to the next rank and what the bonus is right now.
 * The rank comes from the levels summed over the professor's lessons in this turma.
 */
export function MasteryLine({ professor }: { professor: ProfessorId }) {
  const view = useGame(useShallow((store) => masteryView(store.state, content, professor)));
  const { step } = content.balance.mastery;

  const line = view.rank === 0 ? `Sem bônus ainda: some ${step} níveis nas aulas.` : view.line;

  return (
    <div className="mastery" data-maxed={view.maxed} data-honoured={view.honoured} data-qa="mastery">
      <div className="mastery-head">
        <span className="mastery-rank" title={`Um rank a cada ${step} níveis somados nas aulas deste professor`}>
          Domínio <strong>{view.rank}</strong>
          <small>/{view.cap}</small>
        </span>
        {view.honoured ? <span className="mastery-honour">Homenageado</span> : null}
        <span className="mastery-levels">{view.maxed ? 'Máximo' : `${view.levels}/${view.nextAt} níveis`}</span>
      </div>
      <div
        className="mastery-bar"
        role="progressbar"
        aria-label={`Domínio ${content.professors[professor].name}: rank ${view.rank} de ${view.cap}`}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={view.progress}
      >
        <i style={{ width: `${Math.round(view.progress * 100)}%` }} />
      </div>
      <p className="mastery-line">{line}</p>
      <PostdocDefence professor={professor} />
    </div>
  );
}
