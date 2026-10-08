import type { HackathonProfile } from '@/shared/hackathonApi';
import { baseById, HK, setById } from '../lib/hk';

/** The set an item belongs to: how many pieces are worn and which bonuses are on. */
export function ItemSetInfo({ profile, setId }: { profile: HackathonProfile; setId: string | undefined }) {
  const set = setId ? setById.get(setId) : undefined;
  if (!set) return null;
  const worn = profile.items.filter((entry) => {
    const base = baseById.get(entry.base);
    return base?.set === set.id && profile.equipped[base.slot] === entry.id;
  }).length;

  return (
    <div className="hk-itemset">
      <h4>
        {set.name}{' '}
        <small>
          {worn}/{HK.items.filter((entry) => entry.set === set.id).length} equipadas
        </small>
      </h4>
      <ul>
        {set.bonuses.map((bonus) => (
          <li key={bonus.pieces} data-on={worn >= bonus.pieces}>
            <b>{bonus.pieces} peças</b> {bonus.description}
          </li>
        ))}
      </ul>
    </div>
  );
}
