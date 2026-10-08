'use client';
import { useMemo } from 'react';
import type { RunFinishResponse } from '@/shared/hackathonApi';
import { CountUp } from '@/ui/game/moments/CountUp';
import { Button } from '@/ui/kit';
import { Window } from '../screen/Window';
import { useHackathon } from '../store';
import { levelSegments } from '../shared/levelSegments';
import { LegendaryReveal } from './LegendaryReveal';
import { LevelBar } from './LevelBar';
import { PromotionScene } from './PromotionScene';
import { RewardItem } from './RewardItem';
import { useRewardSequence } from './useRewardSequence';
import type { RewardStep } from './useRewardSequence';

interface RewardsScreenProps {
  result: RunFinishResponse;
}

const ORDER: RewardStep[] = ['header', 'xp', 'commits', 'items', 'promotion', 'done'];
const reached = (step: RewardStep, wanted: RewardStep) => ORDER.indexOf(step) >= ORDER.indexOf(wanted);

/** After the fight: what the server decided, shown one piece at a time. */
export function RewardsScreen({ result }: RewardsScreenProps) {
  const dismissResult = useHackathon((store) => store.dismissResult);
  const { outcome, rewards, profile } = result;
  const segments = useMemo(() => levelSegments(profile, rewards), [profile, rewards]);
  const sequence = useRewardSequence({
    items: rewards.items,
    promoted: rewards.promotedTo !== null,
    levelSteps: segments.length,
  });
  const { step } = sequence;
  const done = step === 'done';

  const title = outcome.won ? 'Vitória!' : outcome.reason === 'timeout' ? 'Tempo esgotado' : 'Derrota';

  return (
    <>
      <div className="ar-frame ar-rewards" data-width="md" data-won={outcome.won}>
        <Window title="Resultado da luta" icon="trophy" size="md">
          <div className="ar-rewards-card">
            <h2 className="ar-rewards-title">{title}</h2>
            {rewards.firstClear ? <p className="ar-first">Primeira vitória na fase! Commits em dobro</p> : null}
            {!outcome.won ? <p className="ar-rewards-note">Na derrota você ganha 30% do XP e nenhum item.</p> : null}

            <section className="ar-reward-row" data-shown={reached(step, 'xp')}>
              <p className="ar-reward-value">
                {reached(step, 'xp') ? (
                  <>
                    +<CountUp value={rewards.xp} durationMs={700} delayMs={0} /> XP
                  </>
                ) : (
                  ' '
                )}
              </p>
              <LevelBar segments={segments} active={reached(step, 'xp')} instant={done} />
            </section>

            <section className="ar-reward-row" data-shown={reached(step, 'commits')}>
              {reached(step, 'commits') ? (
                <>
                  <p className="ar-reward-value">
                    +
                    <CountUp value={rewards.commits} durationMs={800} delayMs={0} /> Commits
                  </p>
                  {rewards.recycledCommits > 0 ? (
                    <p className="ar-rewards-note">+{rewards.recycledCommits} Commits de itens reciclados: o inventário está cheio.</p>
                  ) : null}
                </>
              ) : null}
            </section>

            <section className="ar-reward-row" data-shown={reached(step, 'items')}>
              {rewards.items.length === 0 ? (
                reached(step, 'items') ? (
                  <p className="ar-rewards-note">{outcome.won ? 'Nenhum item desta vez.' : 'Sem itens na derrota.'}</p>
                ) : null
              ) : (
                <ul className="ar-drops" aria-label="Itens encontrados">
                  {rewards.items.slice(0, sequence.revealed).map((item) => (
                    <RewardItem key={item.id} item={item} />
                  ))}
                </ul>
              )}
            </section>

            <div className="ar-rewards-actions">
              <Button size="lg" onClick={done ? dismissResult : sequence.skip}>
                {done ? 'Continuar' : 'Pular'}
              </Button>
            </div>
          </div>
        </Window>
      </div>
      {sequence.legendary ? <LegendaryReveal item={sequence.legendary} onClose={sequence.closeLegendary} /> : null}
      {sequence.promotionOpen && rewards.promotedTo ? (
        <PromotionScene cargo={rewards.promotedTo} onClose={sequence.closePromotion} />
      ) : null}
    </>
  );
}
