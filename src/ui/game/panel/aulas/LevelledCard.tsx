import { memo } from 'react';
import { Icon } from '@/ui/kit';
import { useChangeCount } from '../lib/useChangeCount';
import { BuyButton } from './BuyButton';
import { MilestoneBar } from './MilestoneBar';
import { useLevelledCard } from './useLevelledCard';

interface LevelledCardProps {
  id: string;
  kind: 'discipline' | 'clickUpgrade';
}

/** "A aula começa com café. Gera Edécoins por segundo." -> "A aula começa com café." */
const firstSentence = (text: string): string => text.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? text;

/** A discipline or click upgrade. Locked ones read "???" and say what unlocks them. */
export const LevelledCard = memo(function LevelledCard({ id, kind }: LevelledCardProps) {
  const data = useLevelledCard(id);
  const pops = useChangeCount(data?.level);
  if (!data) return null;

  const state = !data.unlocked ? 'locked' : data.affordable ? 'ready' : 'idle';
  const unit = kind === 'discipline' ? '/s' : ' por clique';

  return (
    <article className="lesson-card" data-state={state} data-kind={kind}>
      {pops > 0 ? <span key={pops} className="lesson-card-flash" aria-hidden="true" /> : null}
      <span className="lesson-card-icon" aria-hidden="true">
        {data.unlocked ? data.emoji : <Icon name="lock" size={24} />}
      </span>

      <div className="lesson-card-body">
        <div className="lesson-card-title">
          <h3>{data.unlocked ? data.name : '???'}</h3>
          {data.unlocked ? (
            <span key={pops} className="lesson-card-level" data-pop={pops > 0}>
              Nv {data.level}
            </span>
          ) : null}
        </div>

        {data.unlocked ? (
          <>
            <p className="lesson-card-desc" title={data.description}>
              {firstSentence(data.description)}
            </p>
            <p className="lesson-card-output">
              <strong>
                {data.output}
                {unit}
              </strong>
              <span className="lesson-card-gain">
                <Icon name="arrowUp" size={12} />
                {data.gain}
              </span>
              {kind === 'discipline' && data.share > 0 ? <span className="lesson-card-share">{data.share}% do total</span> : null}
            </p>
            <MilestoneBar filledSegments={data.filledSegments} nextMilestone={data.nextMilestone} />
          </>
        ) : (
          <p className="lesson-card-lock">{data.lockReason}</p>
        )}
      </div>

      {data.unlocked ? (
        <BuyButton id={id} kind={kind} name={data.name} buyCount={data.buyCount} cost={data.cost} affordable={data.affordable} />
      ) : null}
    </article>
  );
});
