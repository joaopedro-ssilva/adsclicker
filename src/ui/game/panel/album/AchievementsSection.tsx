import { useMemo } from 'react';
import { content, useGame } from '@/game/store';
import { achievementViews } from '@/game/engine/views';
import { formatPercent } from '@/game/engine/format';
import { Badge, ProgressBar } from '@/ui/kit';
import { useSlowView } from '../lib/useSlowView';
import { AchievementRow } from './AchievementRow';
import { FAMILY_LABELS, FAMILY_ORDER } from './albumData';

const defsByFamily = FAMILY_ORDER.map((family) => ({
  family,
  defs: content.achievements.filter((def) => def.family === family),
})).filter((group) => group.defs.length > 0);

/** Achievements by family, with the total and the production bonus they add. */
export function AchievementsSection() {
  const unlockedCount = useGame((store) => Object.keys(store.state.achievements).length);
  const views = useSlowView(achievementViews, unlockedCount);
  const byId = useMemo(() => new Map(views.map((view) => [view.id, view])), [views]);

  const total = content.achievements.length;
  const bonus = unlockedCount * content.balance.achievementBonus;

  return (
    <div className="achievements">
      <div className="achievement-summary">
        <div>
          <p className="eyebrow">Conquistas</p>
          <p className="achievement-count">
            <strong>{unlockedCount}</strong>/{total}
          </p>
        </div>
        <Badge tone="good">+{formatPercent(bonus)} de produção</Badge>
        <div className="achievement-summary-bar">
          <ProgressBar value={unlockedCount} max={total} ariaLabel="Conquistas desbloqueadas" segmented segments={24} tone="good" />
        </div>
      </div>

      {defsByFamily.map(({ family, defs }) => {
        const done = defs.filter((def) => byId.get(def.id)?.unlocked).length;
        return (
          <details className="achievement-family" key={family} open={family === 'click'}>
            <summary>
              <span className="achievement-family-name">{FAMILY_LABELS[family]}</span>
              <span className="panel-section-note">
                {done}/{defs.length}
              </span>
            </summary>
            <ul className="achievement-list">
              {defs.map((def) => {
                const view = byId.get(def.id);
                return (
                  <AchievementRow
                    key={def.id}
                    def={def}
                    unlocked={view?.unlocked ?? false}
                    unlockedAt={view?.unlockedAt ?? null}
                    progress={view?.progress === null || view?.progress === undefined ? null : Math.floor(view.progress * 10) / 10}
                  />
                );
              })}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
