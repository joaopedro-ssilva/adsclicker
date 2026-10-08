import type { ItemInstance } from '@/hackathon/engine';
import { ItemCell } from './ItemCell';

interface ItemGridProps {
  items: ItemInstance[];
  /** Total slots of the bag: what the items do not fill is drawn empty. */
  capacity: number;
  equippedIds: ReadonlySet<string>;
  marked: ReadonlySet<string>;
  /** The item open in the detail pane. */
  openId: string | null;
  selecting: boolean;
  onPick: (id: string) => void;
}

/** The inventory as a bag: framed icons first, then the empty slots up to the capacity. */
export function ItemGrid({ items, capacity, equippedIds, marked, openId, selecting, onPick }: ItemGridProps) {
  return (
    <div className="hk-grid" data-qa="hk-grid">
      {items.map((item) => (
        <ItemCell
          key={item.id}
          item={item}
          equipped={equippedIds.has(item.id)}
          selected={selecting ? marked.has(item.id) : item.id === openId}
          selecting={selecting}
          markable={!equippedIds.has(item.id)}
          onPick={onPick}
        />
      ))}
      {Array.from({ length: Math.max(0, capacity - items.length) }, (_, index) => (
        <span key={`empty-${index}`} className="hk-frame hk-cell hk-cell-empty" data-empty="true" aria-hidden="true" />
      ))}
    </div>
  );
}
