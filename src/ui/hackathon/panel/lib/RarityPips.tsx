import type { ItemRarity } from '@/hackathon/content';
import { RARITY_RANK } from './labels';

export function RarityPips({ rarity }: { rarity: ItemRarity }) {
  return (
    <span className="hk-pips" data-rarity={rarity} aria-hidden="true">
      {Array.from({ length: RARITY_RANK[rarity] }, (_, index) => (
        <i key={index} />
      ))}
    </span>
  );
}
