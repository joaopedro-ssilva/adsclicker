'use client';
import { memo } from 'react';
import { useGameState } from '@/game/store';
import type { ActiveBuff } from '@/game/engine/state';
import { formatDuration } from '@/game/engine/format';
import { cssVariables } from '@/ui/theme';

const SOURCE_LABEL: Record<ActiveBuff['source'], string> = {
  ability: 'Habilidade',
  invasion: 'Recompensa de invasão',
  sprint: 'Recompensa de sprint',
};

const BuffChip = memo(function BuffChip({ buff, now }: { buff: ActiveBuff; now: number }) {
  const left = Math.max(0, buff.endsAt - now);
  const total = Math.max(1, buff.endsAt - buff.startedAt);
  return (
    <li className="buff" data-source={buff.source} title={SOURCE_LABEL[buff.source]} style={cssVariables({ '--left': `${(left / total) * 100}%` })}>
      <span className="buff-emoji" aria-hidden="true">
        {buff.emoji}
      </span>
      <span className="buff-name">{buff.name}</span>
      <span className="buff-time">{formatDuration(left)}</span>
    </li>
  );
});

/** Active buffs as chips with the time left. They tick on the engine clock, so they match what is really running. */
export function BuffChips() {
  const buffs = useGameState((state) => state.buffs);
  const now = useGameState((state) => state.lastTickAt);
  if (buffs.length === 0) return null;
  return (
    <ul className="buffs" aria-label="Efeitos ativos">
      {buffs.map((buff) => (
        <BuffChip key={buff.id} buff={buff} now={now} />
      ))}
    </ul>
  );
}
