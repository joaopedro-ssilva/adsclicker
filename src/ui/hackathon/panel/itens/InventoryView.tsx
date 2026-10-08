import { useMemo, useState } from 'react';
import type { SlotId } from '@/hackathon/content';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { Icon } from '@/ui/kit';
import { HK } from '../lib/hk';
import { itemSlot, sortItems, type SortKey } from '../lib/itemInfo';
import { BulkRecycle } from './BulkRecycle';
import { ItemDetailModal } from './ItemDetailModal';
import { ItemGrid } from './ItemGrid';
import { ItemPane } from './ItemPane';
import { ItemToolbar, type SlotFilter } from './ItemToolbar';

interface InventoryViewProps {
  profile: HackathonProfile;
  /** An item the student hub asked to open. */
  focusItem: string | null;
  /** Wide enough for the detail pane beside the grid; otherwise the detail opens in a modal. */
  split: boolean;
}

/** The bag: filter, sort, multi-select recycle, and the detail of the picked item. */
export function InventoryView({ profile, focusItem, split }: InventoryViewProps) {
  const [sort, setSort] = useState<SortKey>('raridade');
  const [slot, setSlot] = useState<SlotFilter>('todos');
  const [selecting, setSelecting] = useState(false);
  const [marked, setMarked] = useState<ReadonlySet<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(focusItem);

  const equippedIds = useMemo(() => new Set(Object.values(profile.equipped).flatMap((id) => (id ? [id] : []))), [profile.equipped]);
  const sorted = useMemo(() => sortItems(profile.items, sort), [profile.items, sort]);
  const visible = useMemo(() => (slot === 'todos' ? sorted : sorted.filter((item) => itemSlot(item) === slot)), [sorted, slot]);
  const counts = useMemo(() => {
    const out: Record<SlotFilter, number> = { todos: profile.items.length, ferramenta: 0, setup: 0, acessorio: 0, amuleto: 0 };
    for (const item of profile.items) {
      const owner: SlotId | null = itemSlot(item);
      if (owner) out[owner] += 1;
    }
    return out;
  }, [profile.items]);

  const markedItems = profile.items.filter((item) => marked.has(item.id) && !equippedIds.has(item.id));
  const commons = profile.items.filter((item) => item.rarity === 'comum' && !equippedIds.has(item.id));
  const openItem = openId ? (profile.items.find((item) => item.id === openId) ?? null) : null;
  const capacity = HK.config.inventorySize;

  const pick = (id: string) => {
    if (!selecting) {
      setOpenId(id);
      return;
    }
    setMarked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const stopSelecting = () => {
    setSelecting(false);
    setMarked(new Set());
  };

  return (
    <div className="hk-inv" data-split={split}>
      <ItemToolbar
        sort={sort}
        onSort={setSort}
        slot={slot}
        onSlot={setSlot}
        counts={counts}
        selecting={selecting}
        onToggleSelecting={() => (selecting ? stopSelecting() : setSelecting(true))}
        disabled={profile.items.length === 0}
      />
      <div className="hk-bag">
        {profile.items.length === 0 ? <p className="hk-empty">Nenhum item ainda. Vença fases para encontrar equipamentos.</p> : null}
        {profile.items.length > 0 && visible.length === 0 ? <p className="hk-empty">Nenhum item neste espaço.</p> : null}
        <ItemGrid items={visible} capacity={capacity} equippedIds={equippedIds} marked={marked} openId={split ? openId : null} selecting={selecting} onPick={pick} />
      </div>
      <footer className="hk-inv-foot">
        <p className="hk-inv-used">
          {profile.items.length} de {capacity} espaços usados
        </p>
        {profile.items.length >= capacity ? (
          <p className="hk-full" role="status">
            <Icon name="lock" size={12} />
            Inventário cheio: os próximos drops viram Commits automaticamente.
          </p>
        ) : null}
        <BulkRecycle marked={markedItems} commons={commons} selecting={selecting} onDone={stopSelecting} />
      </footer>
      {split ? <ItemPane profile={profile} item={openItem} selecting={selecting} onGone={() => setOpenId(null)} /> : null}
      {split ? null : <ItemDetailModal profile={profile} item={openItem} onClose={() => setOpenId(null)} />}
    </div>
  );
}
