import { useMemo, useState } from 'react';
import type { SlotId } from '@/hackathon/content';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { Icon } from '@/ui/kit';
import { HK } from '../lib/hk';
import { itemSlot, sortItems, type SortKey } from '../lib/itemInfo';
import { BulkRecycle } from './BulkRecycle';
import { CollectionView } from './CollectionView';
import { ItemDetailModal } from './ItemDetailModal';
import { ItemGrid } from './ItemGrid';
import { ItemToolbar, type SlotFilter } from './ItemToolbar';

interface ItemsTabProps {
  profile: HackathonProfile;
  /** An item the student tab asked to open. */
  focusItem: string | null;
}

type View = 'inventario' | 'colecao';

/** Inventory (sortable, filterable, with multi-select recycle) and the collection of found bases. */
export function ItemsTab({ profile, focusItem }: ItemsTabProps) {
  const [view, setView] = useState<View>('inventario');
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
  const found = new Set(profile.collection).size;
  const totalBases = HK.items.length;

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
    <>
      <div className="hk-switch" role="group" aria-label="Itens">
        <button type="button" aria-pressed={view === 'inventario'} data-qa="hk-view-inventario" onClick={() => setView('inventario')}>
          Inventário <small>{profile.items.length}/{capacity}</small>
        </button>
        <button type="button" aria-pressed={view === 'colecao'} data-qa="hk-view-colecao" onClick={() => setView('colecao')}>
          Coleção <small>{found}/{totalBases}</small>
        </button>
      </div>

      {view === 'colecao' ? (
        <CollectionView profile={profile} />
      ) : (
        <>
          {profile.items.length >= capacity ? (
            <p className="hk-full" role="status">
              <Icon name="lock" size={12} />
              Inventário cheio: os próximos drops viram Commits automaticamente.
            </p>
          ) : null}
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
          {profile.items.length === 0 ? (
            <p className="hk-empty">Nenhum item ainda. Vença fases para encontrar equipamentos.</p>
          ) : visible.length === 0 ? (
            <p className="hk-empty">Nenhum item neste espaço.</p>
          ) : (
            <ItemGrid items={visible} equippedIds={equippedIds} marked={marked} selecting={selecting} onPick={pick} />
          )}
          <BulkRecycle marked={markedItems} commons={commons} selecting={selecting} onDone={stopSelecting} />
        </>
      )}

      <ItemDetailModal profile={profile} item={openItem} onClose={() => setOpenId(null)} />
    </>
  );
}
