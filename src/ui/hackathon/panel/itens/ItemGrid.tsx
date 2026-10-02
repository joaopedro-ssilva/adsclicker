import type { ItemInstance } from '@/hackathon/engine';
import { ItemCell } from './ItemCell';

interface ItemGridProps {
  items: ItemInstance[];
  equippedIds: ReadonlySet<string>;
  marked: ReadonlySet<string>;
  selecting: boolean;
  onPick: (id: string) => void;
}

/** The inventory as a grid of framed icons. */
export function ItemGrid({ items, equippedIds, marked, selecting, onPick }: ItemGridProps) {
  return (
    <div className="hk-grid" data-qa="hk-grid">
      {items.map((item) => (
        <ItemCell
          key={item.id}
          item={item}
          equipped={equippedIds.has(item.id)}
          selected={marked.has(item.id)}
          selecting={selecting}
          markable={!equippedIds.has(item.id)}
          onPick={onPick}
        />
      ))}
    </div>
  );
}
