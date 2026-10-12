'use client';
import { useEffect, useState } from 'react';
import type { AdminPlayerStats } from '@/shared/api';
import { api } from '@/shared/apiClient';
import { Button } from '@/ui/kit';

interface PlayerStatsProps {
  playerId: string;
  /** Bumped by the row after an action, so the numbers follow. */
  refreshKey: number;
}

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/** Everything about one player, read on the server from the account and the cloud save. Loads when the row opens. */
export function PlayerStats({ playerId, refreshKey }: PlayerStatsProps) {
  const [stats, setStats] = useState<AdminPlayerStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let current = true;
    void api.admin.playerStats(playerId).then((result) => {
      if (!current) return;
      if (result.ok) setStats(result.data);
      setError(result.ok ? null : result.error.message);
    });
    return () => {
      current = false;
    };
  }, [playerId, refreshKey, version]);

  return (
    <section className="admin-stats" data-qa="admin-player-stats" aria-label="Estatísticas do jogador">
      <div className="admin-card-head">
        <h4>Estatísticas</h4>
        <Button size="sm" variant="ghost" onClick={() => setVersion((value) => value + 1)}>
          Atualizar
        </Button>
      </div>
      {error ? (
        <p className="admin-result" role="alert" data-tone="bad">
          {error}
        </p>
      ) : null}
      {stats ? (
        <>
          {!stats.hasSave ? <p className="admin-hint">Este jogador ainda não tem save na nuvem: só os dados da conta.</p> : null}
          <div className="admin-stats-sections">
            {stats.sections.map((section) => (
              <div key={section.title} className="admin-stats-section">
                <h5>{section.title}</h5>
                <dl>
                  {section.rows.map((row) => (
                    <div key={row.label}>
                      <dt>{row.label}</dt>
                      <dd>{row.at !== undefined ? dateFormat.format(row.at) : row.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </>
      ) : !error ? (
        <p className="muted">Carregando estatísticas...</p>
      ) : null}
    </section>
  );
}
