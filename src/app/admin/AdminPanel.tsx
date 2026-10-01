'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { AdminPlayer } from '@/shared/api';
import { Button } from '@/ui/kit';
import { ThemeProvider } from '@/ui/ThemeProvider';
import { logout } from './actions';
import { BrowserCard } from './BrowserCard';
import { EventCard } from './EventCard';
import { PlayersCard } from './PlayersCard';
import { TotalsBar } from './TotalsBar';
import { useAdminPlayers } from './useAdminPlayers';
import { useSelfPlayer } from './useSelfPlayer';

/** Admin tools, all backed by the server: the global event, this browser's player and the player list. */
export function AdminPanel() {
  const list = useAdminPlayers();
  const self = useSelfPlayer();
  const [totalsKey, setTotalsKey] = useState(0);

  const onPlayerChanged = (player: AdminPlayer) => {
    list.replacePlayer(player);
    if (player.self) self.update(player);
  };

  return (
    <ThemeProvider>
      <main className="admin admin-wide">
        <header className="admin-head">
          <div>
            <p className="eyebrow">ADSClicker</p>
            <h1>Admin</h1>
          </div>
          <TotalsBar refreshKey={totalsKey} />
          <div className="admin-actions">
            <Link className="ui-button" data-variant="secondary" href="/">
              Voltar ao jogo
            </Link>
            <form action={logout}>
              <Button type="submit" variant="ghost">
                Sair
              </Button>
            </form>
          </div>
        </header>

        <div className="admin-top">
          <EventCard
            multiplier={list.data?.eventMultiplier ?? null}
            onChanged={() => {
              list.reload();
              setTotalsKey((value) => value + 1);
            }}
          />
          <BrowserCard player={self.player} loading={self.loading} onChanged={onPlayerChanged} />
        </div>

        <PlayersCard list={list} onChanged={onPlayerChanged} />
      </main>
    </ThemeProvider>
  );
}
