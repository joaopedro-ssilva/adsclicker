import { memo } from 'react';
import type { ItemInstance } from '@/hackathon/engine';
import { baseById } from '../lib/hk';
import { itemName } from '../lib/itemInfo';
import { ItemIcon } from '../lib/ItemIcon';
import { RARITY_NAME } from '../lib/labels';

interface ItemCellProps {
  item: ItemInstance;
  equipped: boolean;
  selected: boolean;
  /** Multi-select mode: the cell toggles a mark instead of opening the detail. */
  selecting: boolean;
  /** Equipped items cannot be recycled, so they cannot be marked. */
  markable: boolean;
  onPick: (id: string) => void;
}

/** One inventory slot: the icon framed by rarity, with the level and an equipped marker. */
export const ItemCell = memo(function ItemCell({ item, equipped, selected, selecting, markable, onPick }: ItemCellProps) {
  const base = baseById.get(item.base);
  const disabled = selecting && !markable;
  return (
    <button
      type="button"
      className="hk-cell hk-frame"
      data-rarity={item.rarity}
      data-selected={selected}
      data-equipped={equipped}
      data-qa={`hk-item-${item.id}`}
      aria-pressed={selecting ? selected : undefined}
      aria-disabled={disabled}
      aria-label={`${itemName(item)}, ${RARITY_NAME[item.rarity]}, nível ${item.level}${equipped ? ', equipado' : ''}`}
      onClick={() => {
        if (!disabled) onPick(item.id);
      }}
    >
      {base ? <ItemIcon asset={base.asset} scale={2} /> : null}
      <span className="hk-cell-level" aria-hidden="true">
        {item.level}
      </span>
      {equipped ? (
        <span className="hk-cell-equipped" aria-hidden="true">
          E
        </span>
      ) : null}
      {selecting && selected ? (
        <span className="hk-cell-check" aria-hidden="true">
          ✓
        </span>
      ) : null}
    </button>
  );
});
