'use client';
import { TICK_MS } from '@/hackathon/engine';
import { Keycap, Meter, Tooltip } from '@/ui/kit';
import { skillDefById } from '../shared/lookup';

interface SkillButtonProps {
  skillId: string;
  readyAt: number;
  tick: number;
  /** Cooldown reduction of the build, in percent. */
  cooldownPercent: number;
  /** 1-based position, also the key. */
  slot: number;
  auto: boolean;
  /** An enemy is winding up a heavy hit and this skill blocks it. */
  hinted: boolean;
  disabled: boolean;
  onUse: (id: string) => void;
}

/** An active skill: a radial ring that fills while it recharges. In auto mode it only shows when it fires. */
export function SkillButton({ skillId, readyAt, tick, cooldownPercent, slot, auto, hinted, disabled, onUse }: SkillButtonProps) {
  const def = skillDefById.get(skillId);
  if (!def) return null;
  const totalMs = Math.max(1, def.cooldownMs * (1 - Math.min(80, cooldownPercent) / 100));
  const leftMs = Math.max(0, (readyAt - tick) * TICK_MS);
  const ready = leftMs <= 0;
  const caption = auto ? (ready ? 'auto' : `${Math.ceil(leftMs / 1000)}s`) : ready ? 'Pronto' : `${Math.ceil(leftMs / 1000)}s`;

  return (
    <Tooltip content={`${def.name}: ${def.description}`}>
      <button
        type="button"
        className="ar-skill"
        data-state={ready ? 'ready' : 'cooldown'}
        data-hinted={hinted && ready && !auto}
        data-auto={auto}
        data-no-flow
        disabled={auto || disabled || !ready}
        onClick={() => onUse(skillId)}
        aria-label={`${def.name}, ${auto ? 'automático' : caption}`}
      >
        <Meter value={totalMs - leftMs} max={totalMs} label={def.name} size="md" showLabel={false}>
          <span aria-hidden="true">{def.emoji}</span>
        </Meter>
        <span className="ar-skill-name">{def.name}</span>
        <span className="ar-skill-caption">{caption}</span>
        {auto ? null : (
          <span className="ar-skill-key" aria-hidden="true">
            <Keycap>{slot}</Keycap>
          </span>
        )}
      </button>
    </Tooltip>
  );
}
