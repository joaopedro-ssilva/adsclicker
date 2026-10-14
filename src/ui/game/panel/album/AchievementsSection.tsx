import { useMemo } from 'react';
import { content, useGame } from '@/game/store';
import { achievementViews } from '@/game/engine/views';
import { formatPercent } from '@/game/engine/format';
import type { AchievementDef } from '@/game/content/types';
import type { AchievementView } from '@/game/store/types';
import { audio } from '@/ui/audio';
import { Badge, Button, ProgressBar } from '@/ui/kit';
import { useSlowView } from '../lib/useSlowView';
import { AchievementRow } from './AchievementRow';
import { useAchievementView } from './achievementViewStore';
import type { AchievementFilter, AchievementOrder } from './achievementViewStore';
import { FAMILY_LABELS, FAMILY_ORDER } from './albumData';

const defsByFamily = FAMILY_ORDER.map((family) => ({
  family,
  defs: content.achievements.filter((def) => def.family === family),
})).filter((group) => group.defs.length > 0);

const FILTERS: { value: AchievementFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'done', label: 'Conquistadas' },
  { value: 'missing', label: 'Faltando' },
];

const ORDERS: { value: AchievementOrder; label: string }[] = [
  { value: 'family', label: 'Por família' },
  { value: 'closest', label: 'Mais perto' },
];

function passes(filter: AchievementFilter, view: AchievementView | undefined): boolean {
  const unlocked = view?.unlocked ?? false;
  return filter === 'all' || (filter === 'done' ? unlocked : !unlocked);
}

/** Closest-to-done first; secrets (no progress) and finished ones sink to the end. */
function closestFirst(a: AchievementView | undefined, b: AchievementView | undefined): number {
  const rank = (view: AchievementView | undefined) => (view?.unlocked ? -2 : view?.progress === null || view?.progress === undefined ? -1 : view.progress);
  return rank(b) - rank(a);
}

interface RowsProps {
  defs: AchievementDef[];
  byId: Map<string, AchievementView>;
}

function Rows({ defs, byId }: RowsProps) {
  return (
    <ul className="achievement-list">
      {defs.map((def) => {
        const view = byId.get(def.id);
        return (
          <AchievementRow
            key={def.id}
            def={def}
            unlocked={view?.unlocked ?? false}
            unlockedAt={view?.unlockedAt ?? null}
            progress={view?.progress === null || view?.progress === undefined ? null : Math.floor(view.progress * 100) / 100}
            text={view?.text ?? null}
            note={view?.note ?? null}
          />
        );
      })}
    </ul>
  );
}

/** Achievements by family (or closest to done), with the total and the production bonus they add. */
export function AchievementsSection() {
  const unlockedCount = useGame((store) => Object.keys(store.state.achievements).length);
  const views = useSlowView(achievementViews, unlockedCount);
  const byId = useMemo(() => new Map(views.map((view) => [view.id, view])), [views]);
  const filter = useAchievementView((view) => view.filter);
  const order = useAchievementView((view) => view.order);
  const setFilter = useAchievementView((view) => view.setFilter);
  const setOrder = useAchievementView((view) => view.setOrder);

  const total = content.achievements.length;
  const bonus = unlockedCount * content.balance.achievementBonus;

  const closest = useMemo(
    () =>
      order === 'closest'
        ? content.achievements.filter((def) => passes(filter, byId.get(def.id))).sort((a, b) => closestFirst(byId.get(a.id), byId.get(b.id)))
        : [],
    [order, filter, byId],
  );

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

      <div className="achievement-controls">
        <div className="achievement-switch" role="group" aria-label="Filtro das conquistas">
          {FILTERS.map((item) => (
            <Button
              key={item.value}
              size="sm"
              variant="secondary"
              aria-pressed={filter === item.value}
              onClick={() => {
                audio.play('uiTap');
                setFilter(item.value);
              }}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <div className="achievement-switch" role="group" aria-label="Ordem das conquistas">
          {ORDERS.map((item) => (
            <Button
              key={item.value}
              size="sm"
              variant="secondary"
              aria-pressed={order === item.value}
              onClick={() => {
                audio.play('uiTap');
                setOrder(item.value);
              }}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      {order === 'closest' ? (
        closest.length > 0 ? (
          <Rows defs={closest} byId={byId} />
        ) : (
          <p className="panel-hint">Nada por aqui ainda.</p>
        )
      ) : (
        defsByFamily.map(({ family, defs }) => {
          const done = defs.filter((def) => byId.get(def.id)?.unlocked).length;
          const shown = defs.filter((def) => passes(filter, byId.get(def.id)));
          if (shown.length === 0) return null;
          return (
            <details className="achievement-family" key={`${family}:${filter}`} open={filter !== 'all' || family === 'click'}>
              <summary>
                <span className="achievement-family-name">{FAMILY_LABELS[family]}</span>
                <span className="panel-section-note">
                  {done}/{defs.length}
                </span>
              </summary>
              <Rows defs={shown} byId={byId} />
            </details>
          );
        })
      )}
    </div>
  );
}
