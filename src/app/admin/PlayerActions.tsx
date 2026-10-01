'use client';
import { useState } from 'react';
import { formatNumber } from '@/game/engine/format';
import { api } from '@/shared/apiClient';
import type { AdminPlayer, AdminPlayerPatch } from '@/shared/api';
import { Button } from '@/ui/kit';
import { ActionResultText } from './ActionResultText';
import { MultiplierPicker } from './MultiplierPicker';
import { useApiAction } from './useApiAction';

interface PlayerActionsProps {
  player: AdminPlayer;
  onChanged: (player: AdminPlayer) => void;
}

type Pending = 'ban' | 'clearNickname';

const PRESETS = [1, 10, 50, 100] as const;

const CONFIRM_TEXT: Record<Pending, { question: string; yes: string }> = {
  ban: { question: 'Banir este jogador? Ele sai do ranking e do feed.', yes: 'Sim, banir' },
  clearNickname: { question: 'Remover o apelido? O jogador sai do ranking até escolher outro.', yes: 'Sim, remover' },
};

/** Everything an admin can do to one player, with a confirmation for the destructive ones. */
export function PlayerActions({ player, onChanged }: PlayerActionsProps) {
  const { busy, message, run } = useApiAction();
  const [pending, setPending] = useState<Pending | null>(null);

  const patch = async (body: AdminPlayerPatch, okText: string) => {
    setPending(null);
    const done = await run(() => api.admin.patchPlayer(player.id, body), okText);
    if (done) onChanged(done.player);
  };

  return (
    <div className="admin-actions-panel" data-qa="admin-player-actions">
      <div className="admin-actions-group">
        <h4>Multiplicador de ADScoins</h4>
        <MultiplierPicker
          name={`admin-player-${player.id}`}
          presets={PRESETS}
          current={player.multiplier}
          busy={busy}
          custom
          onApply={(value) => patch({ multiplier: value }, `Multiplicador ×${formatNumber(value)} aplicado.`)}
        />
        <p className="admin-hint">Qualquer valor diferente de ×1 faz do jogador uma conta de teste, fora do ranking.</p>
      </div>

      <div className="admin-actions-group">
        <h4>Marcas</h4>
        <div className="admin-action-buttons">
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            data-qa="admin-toggle-test"
            onClick={() =>
              patch(
                { testAccount: !player.testAccount },
                player.testAccount ? 'Marca de teste removida.' : 'Marcado como conta de teste.',
              )
            }
          >
            {player.testAccount ? 'Tirar marca de teste' : 'Marcar como teste'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            data-qa="admin-toggle-flag"
            onClick={() =>
              patch({ flagged: !player.flagged }, player.flagged ? 'Suspeita limpa: volta ao ranking.' : 'Marcado como suspeito.')
            }
          >
            {player.flagged ? 'Limpar suspeita' : 'Marcar como suspeito'}
          </Button>
          {player.banned ? (
            <Button size="sm" variant="secondary" disabled={busy} data-qa="admin-unban" onClick={() => patch({ banned: false }, 'Jogador desbanido.')}>
              Desbanir
            </Button>
          ) : (
            <Button size="sm" variant="danger" disabled={busy} data-qa="admin-ban" onClick={() => setPending('ban')}>
              Banir
            </Button>
          )}
          <Button
            size="sm"
            variant="danger"
            disabled={busy || !player.nickname}
            data-qa="admin-clear-nickname"
            onClick={() => setPending('clearNickname')}
          >
            Remover apelido
          </Button>
        </div>
      </div>

      {pending ? (
        <div className="admin-confirm" role="alertdialog" aria-label="Confirmar ação">
          <p>{CONFIRM_TEXT[pending].question}</p>
          <div className="admin-action-buttons">
            <Button
              size="sm"
              variant="danger"
              disabled={busy}
              data-qa="admin-confirm-yes"
              onClick={() =>
                pending === 'ban'
                  ? patch({ banned: true }, 'Jogador banido.')
                  : patch({ clearNickname: true }, 'Apelido removido.')
              }
            >
              {CONFIRM_TEXT[pending].yes}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPending(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      <ActionResultText message={message} />
    </div>
  );
}
