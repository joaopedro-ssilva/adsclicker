'use client';
import { ASSETS } from '@/ui/art/manifest';
import { cssVariables } from '@/ui/theme';
import { TICK_MS } from '@/hackathon/engine';
import { enemyById } from '../shared/lookup';
import { slotPosition } from './arenaLayout';
import { ChargeTelegraph } from './ChargeTelegraph';
import { HpBar } from './HpBar';
import type { RosterEntry } from './roster';

interface EnemyActorProps {
  entry: RosterEntry;
  groupSize: number;
  scale: number;
  tick: number;
  /** The student has a block up. */
  covered: boolean;
}

/** One enemy: health bar (and its name when the wave has several), charge warning when it winds up a heavy hit, and its sprite. */
export function EnemyActor({ entry, groupSize, scale, tick, covered }: EnemyActorProps) {
  const { enemy, slot, dying, spawned } = entry;
  const def = enemyById.get(enemy.def);
  const meta = def ? ASSETS[def.asset] : undefined;
  const position = slotPosition(slot, groupSize);
  const charge = def?.traits.find((trait) => trait.kind === 'charge');
  const charging = !dying && enemy.chargeLandsAt !== null && charge !== undefined;
  const width = (meta?.w ?? 40) * scale;
  const height = (meta?.h ?? 46) * scale;

  return (
    <div
      className="ar-enemy"
      data-enemy-uid={enemy.uid}
      data-dying={dying}
      data-boss={def?.boss ?? false}
      data-charging={charging}
      data-entry={spawned ? 'spawn' : 'wave'}
      style={{
        left: `${position.x * 100}%`,
        bottom: position.depth * scale,
        ...cssVariables({ '--slot': String(slot) }),
      }}
    >
      {!dying ? (
        <div className="ar-enemy-info" style={{ width: Math.max(72, width) }}>
          {charging && charge && enemy.chargeLandsAt !== null ? (
            <ChargeTelegraph
              ticksLeft={enemy.chargeLandsAt - tick}
              totalTicks={Math.round(charge.windupMs / TICK_MS)}
              covered={covered}
            />
          ) : null}
          {groupSize > 1 ? <p className="ar-enemy-name">{def?.name ?? 'Bug'}</p> : null}
          <HpBar hp={enemy.hp} maxHp={enemy.maxHp} tone={def?.boss ? 'boss' : 'enemy'} label={`Vida: ${def?.name ?? 'inimigo'}`} />
        </div>
      ) : null}
      <div className="ar-enemy-body">
        {charging ? <span className="ar-charge-ring" aria-hidden="true" /> : null}
        <span
          className="ar-sprite ar-enemy-sprite"
          role="img"
          aria-label={def?.name ?? 'Inimigo'}
          style={{ width, height, backgroundImage: `url(/assets/${def?.asset ?? ''}.png)` }}
        />
      </div>
    </div>
  );
}
