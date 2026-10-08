'use client';
import { useRef, useState } from 'react';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { Window } from '../../screen/Window';
import { useHackathonUi } from '../../screen/uiStore';
import { HK } from '../lib/hk';
import { CollectionView } from './CollectionView';
import { InventoryView } from './InventoryView';
import { useSplitLayout } from './useSplitLayout';

type View = 'inventario' | 'colecao';

/** Items: the inventory with its detail pane, and the collection of found bases. */
export function ItemsWindow({ profile }: { profile: HackathonProfile }) {
  const focusItem = useHackathonUi((store) => store.focusItem);
  const [view, setView] = useState<View>('inventario');
  const root = useRef<HTMLDivElement>(null);
  const split = useSplitLayout(root, 1040);
  const found = new Set(profile.collection).size;

  return (
    <Window title="Itens" icon="shield" size="xl" qa="hk-window-itens">
      <div className="hk-panel hk-items" ref={root}>
        <div className="hk-switch" role="group" aria-label="Itens">
          <button type="button" aria-pressed={view === 'inventario'} data-qa="hk-view-inventario" onClick={() => setView('inventario')}>
            Inventário{' '}
            <small>
              {profile.items.length}/{HK.config.inventorySize}
            </small>
          </button>
          <button type="button" aria-pressed={view === 'colecao'} data-qa="hk-view-colecao" onClick={() => setView('colecao')}>
            Coleção{' '}
            <small>
              {found}/{HK.items.length}
            </small>
          </button>
        </div>
        {view === 'colecao' ? <CollectionView profile={profile} /> : <InventoryView profile={profile} focusItem={focusItem} split={split} />}
      </div>
    </Window>
  );
}
