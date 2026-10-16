'use client';
import { useEffect } from 'react';
import { Button } from '@/ui/kit';
import { useLabOverlay } from './labOverlayStore';

/**
 * "Loja do Laboratório": a placeholder. It will sell skins and decorations for the lab one day; for now it only says so.
 * Nothing here can be bought. It sits over the overlay and owns Esc while it is open (the overlay yields to an open dialog).
 */
export function Shop() {
  const open = useLabOverlay((store) => store.shopOpen);
  const close = useLabOverlay((store) => store.closeShop);

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
  return (
    <div className="lab-shop-scrim" onPointerDown={(event) => event.target === event.currentTarget && close()} data-qa="lab-shop">
      <section className="lab-shop" role="dialog" aria-modal="true" aria-labelledby="lab-shop-title">
        <span className="lab-shop-emoji" aria-hidden="true">
          🛒
        </span>
        <h3 id="lab-shop-title">Loja do Laboratório</h3>
        <p className="lab-shop-soon">Em breve</p>
        <p>Skins e decorações para o Laboratório.</p>
        <Button variant="secondary" onClick={close} data-qa="lab-shop-close">
          Fechar
        </Button>
      </section>
    </div>
  );
}
