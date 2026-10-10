'use client';
import { useState } from 'react';
import { formatNumber } from '@/game/engine/format';
import { api } from '@/shared/apiClient';
import type { AdminPlayer, AdminPlayerPatch } from '@/shared/api';
import { TITLES } from '@/shared/titles';
import { Button } from '@/ui/kit';
import { ActionResultText } from './ActionResultText';
import { MultiplierPicker } from './MultiplierPicker';
import { useApiAction } from './useApiAction';

interface PlayerActionsProps {
  player: AdminPlayer;
  onChanged: (player: AdminPlayer) => void;
}

type Pending = 'ban' | 'clearNickname' | 'resetPassword';

const PRESETS = [1, 10, 50, 100] as const;

const CONFIRM_TEXT: Record<Pending, (name: string) => { question: string; yes: string }> = {
  ban: () => ({ question: 'Banir este jogador? Ele sai do ranking e do feed.', yes: 'Sim, banir' }),
  clearNickname: () => ({ question: 'Remover o apelido? O jogador sai do ranking até escolher outro.', yes: 'Sim, remover' }),
  resetPassword: (name) => ({
    question: `Redefinir a senha de ${name}? A senha atual deixa de valer e todos os aparelhos dele são desconectados.`,
    yes: 'Sim, redefinir',
  }),
};

/** Everything an admin can do to one player, with a confirmation for the destructive ones. */
export function PlayerActions({ player, onChanged }: PlayerActionsProps) {
  const { busy, message, run } = useApiAction();
  const [pending, setPending] = useState<Pending | null>(null);
  // Held only in this component's memory: leaving or refreshing loses it, by design.
  const [temporary, setTemporary] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const patch = async (body: AdminPlayerPatch, okText: string) => {
    setPending(null);
    const done = await run(() => api.admin.patchPlayer(player.id, body), okText);
    if (done) onChanged(done.player);
  };

  const resetPassword = async () => {
    setPending(null);
    setTemporary(null);
    setCopied(false);
    const done = await run(() => api.admin.resetPassword(player.id), 'Senha redefinida.');
    if (done) {
      setTemporary(done.temporaryPassword);
      onChanged(done.player);
    }
  };

  const copyTemporary = async () => {
    try {
      await navigator.clipboard.writeText(temporary ?? '');
      setCopied(true);
    } catch {
      setCopied(false);
    }
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

      <div className="admin-actions-group">
        <h4>Títulos</h4>
        <div className="admin-action-buttons">
          {TITLES.map((title) => {
            const held = player.titles?.includes(title.id) ?? false;
            return (
              <Button
                key={title.id}
                size="sm"
                variant={held ? 'secondary' : 'primary'}
                disabled={busy}
                title={title.description}
                data-qa={`admin-title-${title.id}`}
                data-held={held || undefined}
                onClick={() =>
                  patch(
                    held ? { revokeTitle: title.id } : { grantTitle: title.id },
                    held ? `Título "${title.label}" removido.` : `Título "${title.label}" concedido.`,
                  )
                }
              >
                {held ? `Tirar "${title.label}"` : `Dar "${title.label}"`}
              </Button>
            );
          })}
        </div>
        <p className="admin-hint">Títulos aparecem como selo ao lado do apelido nos rankings e no mural. Valem para sempre, inclusive depois do reset de lançamento.</p>
      </div>

      <div className="admin-actions-group">
        <h4>Senha</h4>
        <div className="admin-action-buttons">
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || !player.nickname}
            data-qa="admin-reset-password"
            onClick={() => setPending('resetPassword')}
          >
            Redefinir senha
          </Button>
        </div>
        <p className="admin-hint">
          {player.nickname
            ? 'Gera uma senha temporária, desconecta todos os aparelhos do jogador e mostra a senha uma única vez.'
            : 'Só contas com apelido têm senha para redefinir.'}
        </p>
      </div>

      {temporary ? (
        <div className="admin-temp-password" role="status" data-qa="admin-temp-password">
          <p>
            Senha temporária de <strong>{player.nickname}</strong>
          </p>
          <div className="admin-temp-password-row">
            <code data-qa="admin-temp-password-value">{temporary}</code>
            <Button size="sm" variant="primary" onClick={copyTemporary} data-qa="admin-temp-password-copy">
              {copied ? 'Copiada' : 'Copiar'}
            </Button>
          </div>
          <p className="admin-hint">
            Passe esta senha ao jogador. Ela não será mostrada de novo: se você sair ou recarregar a página, ela se perde. Peça para ele trocá-la
            logo depois de entrar (na conta, em &quot;Trocar senha&quot;).
          </p>
          <Button size="sm" variant="ghost" onClick={() => setTemporary(null)}>
            Fechar
          </Button>
        </div>
      ) : null}

      {pending ? (
        <div className="admin-confirm" role="alertdialog" aria-label="Confirmar ação">
          <p>{CONFIRM_TEXT[pending](player.nickname ?? 'este jogador').question}</p>
          <div className="admin-action-buttons">
            <Button
              size="sm"
              variant="danger"
              disabled={busy}
              data-qa="admin-confirm-yes"
              onClick={() =>
                pending === 'ban'
                  ? patch({ banned: true }, 'Jogador banido.')
                  : pending === 'resetPassword'
                    ? resetPassword()
                    : patch({ clearNickname: true }, 'Apelido removido.')
              }
            >
              {CONFIRM_TEXT[pending](player.nickname ?? 'este jogador').yes}
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
