'use client';
import { useEffect, useState } from 'react';
import { formatNumber } from '@/game/engine/format';
import type { LabCosmeticEntry } from '@/game/engine/views';
import { useCoins, useGame, useLabCosmeticsView } from '@/game/store';
import { Button } from '@/ui/kit';
import { CosmeticCard } from './CosmeticCard';
import { useLabOverlay } from './labOverlayStore';

type Filter = 'todos' | 'monitor' | 'theme' | 'decor' | 'start';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'todos', label: 'Tudo' },
  { id: 'monitor', label: 'Monitores' },
  { id: 'theme', label: 'Temas' },
  { id: 'decor', label: 'Decoração' },
  { id: 'start', label: 'Itens iniciais' },
];

function ShopCard({ entry }: { entry: LabCosmeticEntry }) {
  const buy = useGame((store) => store.buyLabCosmetic);
  const equip = useGame((store) => store.equipLabCosmetic);
  let actions;
  if (entry.owned) {
    actions = entry.equipped ? null : (
      <Button size="sm" variant="secondary" onClick={() => equip(entry.id)} data-qa="lab-shop-equip">
        Equipar
      </Button>
    );
  } else if (entry.forSale) {
    actions = (
      <Button
        size="sm"
        disabled={!entry.affordable}
        onClick={() => buy(entry.id)}
        title={entry.affordable ? undefined : 'ADScoins insuficientes.'}
        data-qa="lab-shop-buy"
      >
        Comprar
      </Button>
    );
  }
  return (
    <CosmeticCard
      entry={entry}
      lock={
        entry.forSale ? (
          <span className="lab-shop-price" data-poor={!entry.affordable || undefined}>
            {entry.priceText} ADScoins
          </span>
        ) : (
          <>{entry.hint ?? 'Conquista'}</>
        )
      }
      actions={actions}
    />
  );
}

/**
 * "Loja do Laboratório": monitor skins, lab themes, decorations and starting items, bought with ADScoins at fixed, high
 * prices (content/labCosmetics.ts). What is bought is owned for good, graduation included. A few things are not sold:
 * they are achievement rewards. It sits over the overlay and owns Esc while it is open (the overlay yields to it).
 */
export function Shop() {
  const open = useLabOverlay((store) => store.shopOpen);
  const close = useLabOverlay((store) => store.closeShop);
  const setTab = useLabOverlay((store) => store.setTab);
  const view = useLabCosmeticsView();
  const coins = useCoins();
  const [filter, setFilter] = useState<Filter>('todos');

  useEffect(() => {
    if (!open) return;
    document.querySelector<HTMLElement>('[data-qa="lab-shop-close"]')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;
  const groups: {
    id: Exclude<Filter, 'todos'>;
    title: string;
    entries: LabCosmeticEntry[];
  }[] = [
    { id: 'monitor', title: 'Skins do monitor', entries: view.monitors },
    { id: 'theme', title: 'Temas do Laboratório', entries: view.themes },
    { id: 'decor', title: 'Decoração', entries: view.decor },
    { id: 'start', title: 'Itens iniciais', entries: view.starts },
  ];
  return (
    <div className="lab-shop-scrim" onPointerDown={(event) => event.target === event.currentTarget && close()} data-qa="lab-shop">
      <section className="lab-shop" role="dialog" aria-modal="true" aria-labelledby="lab-shop-title">
        <header className="lab-shop-head">
          <h3 id="lab-shop-title">
            <span aria-hidden="true">🛒</span> Loja do Laboratório
          </h3>
          <p className="lab-shop-wallet" aria-label="Suas ADScoins">
            ADScoins <b data-qa="lab-shop-coins">{formatNumber(coins, { integer: true })}</b>
          </p>
          <Button variant="secondary" size="sm" onClick={close} data-qa="lab-shop-close">
            Fechar
          </Button>
        </header>
        <p className="lab-shop-lead">
          Tudo aqui é só visual, menos o item inicial (um empurrãozinho no começo da pesquisa). O que você compra é seu para sempre, mesmo depois da
          formatura.
        </p>
        <div role="tablist" aria-label="Tipos de cosmético" className="lab-shop-filters">
          {FILTERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={filter === entry.id}
              onClick={() => setFilter(entry.id)}
              data-qa={`lab-shop-filter-${entry.id}`}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <div className="lab-shop-body">
          {groups
            .filter((group) => filter === 'todos' || filter === group.id)
            .map((group) => (
              <section key={group.id} className="lab-shop-group" aria-label={group.title}>
                <h4>{group.title}</h4>
                <ul className="lab-cosm-list">
                  {group.entries.map((entry) => (
                    <ShopCard key={entry.id} entry={entry} />
                  ))}
                </ul>
              </section>
            ))}
        </div>
        <footer className="lab-shop-foot">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              close();
              setTab('cosmeticos');
            }}
            data-qa="lab-shop-wardrobe"
          >
            Ir para Cosméticos
          </Button>
        </footer>
      </section>
    </div>
  );
}
