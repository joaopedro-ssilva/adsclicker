import { useMemo } from 'react';
import type { ItemInstance } from '@/hackathon/engine';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { Delta } from '../lib/Delta';
import { baseById } from '../lib/hk';
import { itemName } from '../lib/itemInfo';
import { isStat, META_INFO, metaValue, RARITY_NAME, STAT_INFO, statValue } from '../lib/labels';
import { equippedItems, swapDeltas, type BuildDelta } from '../lib/profileBuild';

interface Row {
  label: string;
  before: string;
  after: string;
  diff: number;
  suffix: string;
  decimals: number;
}

function describe(delta: BuildDelta): Row {
  const { id, before, after } = delta;
  if (isStat(id)) {
    const agility = id === 'agilidade';
    return {
      label: STAT_INFO[id].label,
      before: statValue(id, before),
      after: statValue(id, after),
      diff: agility ? (after - before) / 100 : after - before,
      suffix: agility ? '/s' : id === 'atencao' ? '%' : '',
      decimals: agility ? 2 : 0,
    };
  }
  return { label: META_INFO[id].label, before: metaValue(before), after: metaValue(after), diff: after - before, suffix: '%', decimals: 1 };
}

/** The same slot today versus with this item: what the build gains and loses, from the engine itself. */
export function ItemCompare({ profile, item }: { profile: HackathonProfile; item: ItemInstance }) {
  const slot = baseById.get(item.base)?.slot;
  const current = slot ? equippedItems(profile)[slot] : undefined;
  const deltas = useMemo(() => (slot ? swapDeltas(profile, slot, item) : []), [profile, slot, item]);

  if (!slot) return null;
  return (
    <section className="hk-compare" data-qa="hk-compare">
      <h3>Comparar com o equipado</h3>
      <p className="hk-note">
        {current ? (
          <>
            Agora:{' '}
            <strong className="hk-rar-text" data-rarity={current.rarity}>
              {itemName(current)}
            </strong>{' '}
            ({RARITY_NAME[current.rarity]}, nível {current.level}).
          </>
        ) : (
          'O espaço está vazio: tudo o que o item der é ganho.'
        )}
      </p>
      {deltas.length === 0 ? (
        <p className="hk-note">Sem diferença nos atributos.</p>
      ) : (
        <ul className="hk-deltas">
          {deltas.map((delta) => {
            const row = describe(delta);
            return (
              <li key={delta.id}>
                <span className="hk-delta-label">{row.label}</span>
                <span className="hk-delta-values">
                  {row.before} → {row.after}
                </span>
                <Delta value={row.diff} suffix={row.suffix} decimals={row.decimals} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
