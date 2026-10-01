'use client';
import { useEffect, useState } from 'react';
import type { AdminPlayer } from '@/shared/api';
import { Button, Panel } from '@/ui/kit';
import { PlayerRow } from './PlayerRow';
import type { AdminPlayersState } from './useAdminPlayers';

const SEARCH_DELAY_MS = 300;

interface PlayersCardProps {
  list: AdminPlayersState;
  onChanged: (player: AdminPlayer) => void;
}

/** Searchable, paginated player table. Rows expand into their actions. */
export function PlayersCard({ list, onChanged }: PlayersCardProps) {
  const { data, error, loading, page, setPage, setSearch, reload } = list;
  const [text, setText] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(text.trim()), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [text, setSearch]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const players = data?.players ?? [];

  return (
    <Panel className="admin-card admin-players">
      <div className="admin-card-head">
        <h2>Jogadores</h2>
        <div className="admin-search">
          <label htmlFor="admin-search" className="sr-only">
            Buscar por apelido
          </label>
          <input
            id="admin-search"
            type="search"
            placeholder="Buscar por apelido"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <Button size="sm" variant="ghost" onClick={reload} disabled={loading} data-qa="admin-reload">
            Atualizar
          </Button>
        </div>
      </div>

      {error && !data ? (
        <p className="admin-result" role="alert" data-tone="bad">
          {error.code === 'unavailable'
            ? 'O servidor está fora do ar ou sem banco de dados configurado.'
            : error.code === 'unauthorized' || error.code === 'forbidden'
              ? 'Sessão de admin inválida. Saia e entre de novo.'
              : error.message}
        </p>
      ) : null}
      {error && data ? (
        <p className="admin-result" role="alert" data-tone="bad">
          Não foi possível atualizar a lista: {error.message}
        </p>
      ) : null}

      {data ? (
        <div className="admin-table-wrap" aria-busy={loading}>
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Jogador</th>
                <th scope="col">Último acesso</th>
                <th scope="col">Tempo de jogo</th>
                <th scope="col" className="admin-num">
                  ADScoins
                </th>
                <th scope="col" className="admin-num">
                  Diplomas
                </th>
                <th scope="col" className="admin-num">
                  Conquistas
                </th>
                <th scope="col">Marcas</th>
                <th scope="col">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody data-loading={loading || undefined}>
              {players.length === 0 ? (
                <tr>
                  <td colSpan={8} className="admin-empty">
                    {list.search ? 'Nenhum jogador com esse apelido.' : 'Nenhum jogador ainda.'}
                  </td>
                </tr>
              ) : (
                players.map((player) => (
                  <PlayerRow
                    key={player.id}
                    player={player}
                    now={list.fetchedAt}
                    open={openId === player.id}
                    onToggle={() => setOpenId(openId === player.id ? null : player.id)}
                    onChanged={onChanged}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : !error ? (
        <p className="muted">Carregando jogadores...</p>
      ) : null}

      {data ? (
        <nav className="admin-pager" aria-label="Páginas de jogadores">
          <span className="muted">
            {data.total} {data.total === 1 ? 'jogador' : 'jogadores'}
            {list.search ? ' na busca' : ''} · página {data.page} de {pages}
          </span>
          <span className="admin-pager-buttons">
            <Button size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)} data-qa="admin-prev">
              Anterior
            </Button>
            <Button size="sm" variant="secondary" disabled={page >= pages || loading} onClick={() => setPage(page + 1)} data-qa="admin-next">
              Próxima
            </Button>
          </span>
        </nav>
      ) : null}
    </Panel>
  );
}
