import type { HackathonProfile } from '@/shared/hackathonApi';
import { baseById, HK } from '../lib/hk';
import { equippedItems } from '../lib/profileBuild';

/** Every set with how many of its pieces are worn; the bonuses already earned are lit. */
export function SetBonuses({ profile }: { profile: HackathonProfile }) {
  const equipped = Object.values(equippedItems(profile));
  return (
    <div className="hk-sets" data-qa="hk-sets">
      {HK.sets.map((set) => {
        const total = HK.items.filter((base) => base.set === set.id).length;
        const worn = equipped.filter((item) => baseById.get(item.base)?.set === set.id).length;
        return (
          <article key={set.id} className="hk-card hk-set" data-active={worn >= 2}>
            <header>
              <h3>{set.name}</h3>
              <span className="hk-set-count">
                {worn}/{total} peças
              </span>
            </header>
            <ul>
              {set.bonuses.map((bonus) => (
                <li key={bonus.pieces} data-on={worn >= bonus.pieces}>
                  <b>{bonus.pieces} peças</b>
                  <span>{bonus.description}</span>
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </div>
  );
}
