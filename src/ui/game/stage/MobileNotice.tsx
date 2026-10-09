'use client';
import { useState, useSyncExternalStore } from 'react';

const KEY = 'adsclicker.mobileNoticeClosed';

const subscribe = () => () => undefined;

function wasClosed(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** A thin bar on phones saying the full experience is on a computer. Closed once, it stays closed on that device. */
export function MobileNotice() {
  // On the server it counts as closed, so the bar never flashes for someone who closed it.
  const stored = useSyncExternalStore(subscribe, wasClosed, () => true);
  const [closed, setClosed] = useState(false);

  if (stored || closed) return null;

  const close = () => {
    setClosed(true);
    try {
      window.localStorage.setItem(KEY, '1');
    } catch {
      // Without storage the bar comes back on the next visit, which is fine.
    }
  };

  return (
    <div className="mobile-note" role="note" data-qa="mobile-note">
      <span>A experiência completa é no computador.</span>
      <button type="button" aria-label="Fechar o aviso" onClick={close}>
        ×
      </button>
    </div>
  );
}
