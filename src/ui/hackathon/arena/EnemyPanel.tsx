'use client';
import type { EnemyState } from '@/hackathon/engine';
import { Card } from '../screen/Card';
import { enemyById } from '../shared/lookup';
import { HpBar } from './HpBar';

interface EnemyPanelProps {
  enemies: EnemyState[];
}

/**
 * The enemy under the student's blows: the first one standing, as the engine picks it. With several in the wave it
 * says how many are left.
 */
export function EnemyPanel({ enemies }: EnemyPanelProps) {
  const alive = enemies.filter((enemy) => enemy.hp > 0);
  const target = alive[0];
  // The engine keeps a defeated enemy at 0 HP until the wave ends: between waves the panel shows it, empty.
  const shown = target ?? enemies[0];
  const def = shown ? enemyById.get(shown.def) : undefined;
  const boss = def?.boss === true;

  return (
    <Card className="ar-panel ar-panel-enemy" qa="ar-enemy-panel">
      <div className="ar-panel-head" data-boss={boss}>
        <p className="ar-panel-name">{def?.name ?? 'Bug'}</p>
        {boss ? <span className="ar-panel-tag">Chefe</span> : null}
        {alive.length > 1 ? <p className="ar-panel-left">{alive.length} restantes</p> : null}
      </div>
      <div className="ar-panel-row">
        <span className="ar-heart" aria-hidden="true">
          ♥
        </span>
        <HpBar hp={target?.hp ?? 0} maxHp={shown?.maxHp ?? 1} tone={boss ? 'boss' : 'enemy'} label={`Vida: ${def?.name ?? 'inimigo'}`} />
      </div>
    </Card>
  );
}
