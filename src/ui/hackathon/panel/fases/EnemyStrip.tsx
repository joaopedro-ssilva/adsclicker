import { ASSETS } from '@/ui/art/manifest';
import { enemyById } from '../lib/hk';

/** The distinct enemies of a list of waves, as sprites at their native size. */
export function EnemyStrip({ waves }: { waves: string[][] }) {
  const ids = [...new Set(waves.flat())];
  return (
    <ul className="hk-enemies" aria-label="Inimigos">
      {ids.map((id) => {
        const enemy = enemyById.get(id);
        if (!enemy) return null;
        const meta = ASSETS[enemy.asset];
        return (
          <li key={id} data-boss={enemy.boss} title={`${enemy.name}: ${enemy.description}`}>
            <span className="hk-enemy-frame">
              <span
                className="hk-icon"
                aria-hidden="true"
                style={{ width: meta?.w ?? 40, height: meta?.h ?? 40, backgroundImage: `url(/assets/${enemy.asset}.png)` }}
              />
            </span>
            <small>{enemy.name}</small>
          </li>
        );
      })}
    </ul>
  );
}
