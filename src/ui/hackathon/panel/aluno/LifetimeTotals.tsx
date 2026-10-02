import type { HackathonProfile } from '@/shared/hackathonApi';
import { HK } from '../lib/hk';
import { whole } from '../lib/labels';

/** Lifetime counters, plus how far the legendary guarantee is. */
export function LifetimeTotals({ profile }: { profile: HackathonProfile }) {
  const { totals, pity } = profile;
  const left = Math.max(0, HK.config.pityVictories - pity);
  const rows = [
    ['Vitórias', totals.victories],
    ['Derrotas', totals.defeats],
    ['Itens achados', totals.itemsFound],
    ['Lendários', totals.legendaries],
  ] as const;
  return (
    <div className="hk-card hk-totals" data-qa="hk-totals">
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{whole(value)}</dd>
          </div>
        ))}
      </dl>
      <p className="hk-note">
        {left === 0
          ? 'O próximo item é lendário garantido.'
          : `Lendário garantido em ${left} ${left === 1 ? 'vitória' : 'vitórias'} sem lendário.`}
      </p>
    </div>
  );
}
