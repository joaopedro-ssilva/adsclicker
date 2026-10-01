import { memo } from 'react';
import type { AchievementDef } from '@/game/content/types';
import { content } from '@/game/content';
import { Icon, ProgressBar } from '@/ui/kit';
import type { IconName } from '@/ui/kit';

interface AchievementRowProps {
  def: AchievementDef;
  unlocked: boolean;
  unlockedAt: number | null;
  /** 0..1, rounded by the caller so the row only re-renders on visible changes. */
  progress: number | null;
}

const dateFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

interface RewardChip {
  icon: IconName;
  label: string;
}

function rewardChips(def: AchievementDef): RewardChip[] {
  const chips: RewardChip[] = [];
  const { skin, scenery, theme } = def.reward ?? {};
  const skinName = skin ? content.skins.find((entry) => entry.id === skin)?.name : undefined;
  const sceneryName = scenery ? content.sceneries.find((entry) => entry.id === scenery)?.name : undefined;
  const themeName = theme ? content.themes.find((entry) => entry.id === theme)?.name : undefined;
  if (skinName) chips.push({ icon: 'shirt', label: skinName });
  if (sceneryName) chips.push({ icon: 'image', label: sceneryName });
  if (themeName) chips.push({ icon: 'palette', label: themeName });
  return chips;
}

/** One achievement. A locked secret one shows nothing but "???". */
export const AchievementRow = memo(function AchievementRow({ def, unlocked, unlockedAt, progress }: AchievementRowProps) {
  const hidden = def.secret === true && !unlocked;
  const chips = hidden ? [] : rewardChips(def);

  return (
    <li className="achievement-row" data-unlocked={unlocked}>
      <span className="achievement-icon" aria-hidden="true">
        {hidden ? <Icon name="lock" size={24} /> : def.emoji}
      </span>
      <div className="achievement-text">
        <h4>{hidden ? '???' : def.name}</h4>
        <p>{hidden ? 'Conquista secreta' : def.description}</p>
        {chips.length > 0 ? (
          <ul className="achievement-rewards" aria-label="Recompensas">
            {chips.map((chip) => (
              <li key={chip.label} data-owned={unlocked}>
                <Icon name={chip.icon} size={12} />
                {chip.label}
              </li>
            ))}
          </ul>
        ) : null}
        {!unlocked && progress !== null && progress > 0 && !hidden ? (
          <ProgressBar value={progress} max={1} ariaLabel={`Progresso de ${def.name}`} size="sm" segmented segments={10} />
        ) : null}
      </div>
      <span className="achievement-status">
        {unlocked && unlockedAt !== null ? (
          <>
            <Icon name="check" size={12} />
            {dateFormat.format(unlockedAt)}
          </>
        ) : null}
      </span>
    </li>
  );
});
