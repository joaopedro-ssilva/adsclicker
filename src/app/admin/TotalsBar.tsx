'use client';
import { useEffect, useState } from 'react';
import { formatNumber } from '@/game/engine/format';
import { api } from '@/shared/apiClient';

interface Totals {
  players: number;
  online: number;
}

/**
 * Players and online now, from the public community numbers (the admin list only carries the count of the
 * current search). Refreshes whenever `refreshKey` changes.
 */
export function TotalsBar({ refreshKey }: { refreshKey: number }) {
  const [totals, setTotals] = useState<Totals | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    void api.community(abort.signal).then((result) => {
      if (result.ok) setTotals({ players: result.data.players, online: result.data.online });
    });
    return () => abort.abort();
  }, [refreshKey]);

  const show = (value: number | undefined) => (value === undefined ? '-' : formatNumber(value, { integer: true }));
  return (
    <dl className="admin-totals" data-qa="admin-totals">
      <div>
        <dt>Jogadores</dt>
        <dd>{show(totals?.players)}</dd>
      </div>
      <div>
        <dt>
          <span className="admin-dot" data-on="true" aria-hidden="true" /> Online agora
        </dt>
        <dd>{show(totals?.online)}</dd>
      </div>
    </dl>
  );
}
