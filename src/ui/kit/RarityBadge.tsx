import type { Rarity } from '@/game/content/types';

const LABELS: Record<Rarity, string> = { common: 'Comum', rare: 'Rara', epic: 'Épica', legendary: 'Lendária' };
const PIPS: Record<Rarity, number> = { common: 1, rare: 2, epic: 3, legendary: 4 };

/** The pips repeat the rank, so rarity never depends on colour alone. */
export function RarityBadge({ rarity }: { rarity: Rarity }) {
  return (
    <span className="ui-badge rarity-badge" data-rarity={rarity}>
      <span className="rarity-pips" aria-hidden="true">
        {Array.from({ length: PIPS[rarity] }, (_, index) => (
          <i key={index} />
        ))}
      </span>
      {LABELS[rarity]}
    </span>
  );
}
