'use client';
import { useEffect, useRef } from 'react';
import { audio } from '@/ui/audio';
import { fx } from '@/ui/fx';
import { cssVariables } from '@/ui/theme';
import type { ItemInstance } from '@/hackathon/engine';
import { ItemSprite } from '../shared/ItemSprite';
import { itemBaseById, RARITY_NAME, RARITY_RANK, rarityColor } from '../shared/lookup';
import { affixText } from '../shared/stats';

interface RewardItemProps {
  item: ItemInstance;
}

const SOUND = ['buy', 'buy', 'unlock', 'achievement', 'achievement'] as const;

/** A dropped item as it is revealed: the better the rarity, the louder the entrance. */
export function RewardItem({ item }: RewardItemProps) {
  const base = itemBaseById.get(item.base);
  const rank = RARITY_RANK[item.rarity];
  const card = useRef<HTMLLIElement>(null);

  useEffect(() => {
    audio.play(SOUND[rank] ?? 'buy');
    if (rank < 2 || !card.current) return;
    const rect = card.current.getBoundingClientRect();
    const at = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    fx.sparkles({ ...at, count: 18 * rank, color: item.rarity === 'raro' ? '#79b7ff' : item.rarity === 'epico' ? '#c69bff' : '#f7ca75' });
    if (rank >= 4) fx.confetti({ ...at, count: 80 });
  }, [rank, item.rarity]);

  return (
    <li
      ref={card}
      className="ar-drop"
      data-rarity={item.rarity}
      style={cssVariables({ '--rarity': rarityColor(item.rarity), '--rank': String(rank) })}
    >
      <div className="ar-drop-art">
        <ItemSprite asset={base?.asset ?? ''} scale={3} />
      </div>
      <div className="ar-drop-info">
        <p className="ar-drop-rarity">{RARITY_NAME[item.rarity]}</p>
        <p className="ar-drop-name">{base?.name ?? item.base}</p>
        <ul className="ar-drop-affixes">
          {item.affixes.map((affix) => (
            <li key={`${affix.target}-${affix.op}`}>{affixText(affix)}</li>
          ))}
        </ul>
      </div>
    </li>
  );
}
