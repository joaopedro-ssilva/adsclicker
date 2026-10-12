'use client';
import { useState } from 'react';
import { formatNumber } from '@/game/engine/format';
import { api } from '@/shared/apiClient';
import type { AdminPlayer, AdminPlayerPatch, AdminTag } from '@/shared/api';
import { tagTextColor } from '@/shared/tags';
import { cssVariables } from '@/ui/theme';
import { Button } from '@/ui/kit';
import { ActionResultText } from './ActionResultText';
import { MultiplierPicker } from './MultiplierPicker';
import { useApiAction } from './useApiAction';

interface PlayerActionsProps {
  player: AdminPlayer;
  /** The tag catalogue; null while it loads. */
  tags: AdminTag[] | null;
  onChanged: (player: AdminPlayer) => void;
  /** A tag was given or taken: the holder counts of the catalogue move. */
  onTagsChanged: () => void;
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
export function PlayerActions({ player, tags, onChanged, onTagsChanged }: PlayerActionsProps) {
  const { busy, message, run } = useApiAction();
  const [pending, setPending] = useState<Pending | null>(null);
  // Held only in this component's memory: leaving or refreshing loses it, by design.
  const [temporary, setTemporary] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const patch = async (body: AdminPlayerPatch, okText: string) => {
    setPending(null);
    const done = await run(() => api.admin.patchPlayer(player.id, body), okText);
    if (done) onChanged(done.player);
    if (done && (body.grantTag !== undefined || body.revokeTag !== undefined)) onTagsChanged();
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
          <Button
            size="sm"
            variant={player.trusted ? 'secondary' : 'primary'}
            disabled={busy}
            data-qa="admin-toggle-trusted"
            onClick={() =>
              patch(
                { trusted: !player.trusted },
                player.trusted ? 'Marca de confiável removida: o anticheat volta a valer.' : 'Confiável: o anticheat não marca mais este jogador.',
              )
            }
          >
            {player.trusted ? 'Tirar confiável' : 'Limpar de vez (confiável)'}
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
        <p className="admin-hint">
          <strong>Confiável</strong> limpa a suspeita atual e faz o anticheat nunca mais marcar este jogador: ele fica no ranking mesmo se o save
          parecer impossível (o caso continua no log como &quot;Anticheat ignorado&quot;). A marca manual de suspeito continua funcionando.
        </p>
      </div>

      <div className="admin-actions-group">
        <h4>Tags</h4>
        {tags === null ? (
          <p className="muted">Carregando tags...</p>
        ) : tags.length === 0 ? (
          <p className="admin-hint">Nenhuma tag criada. Crie uma no card &quot;Tags&quot;.</p>
        ) : (
          <div className="admin-action-buttons">
            {tags.map((tag) => {
              const held = player.tags.includes(tag.id);
              return (
                <Button
                  key={tag.id}
                  size="sm"
                  variant={held ? 'secondary' : 'primary'}
                  disabled={busy}
                  title={tag.description || undefined}
                  data-qa={`admin-tag-${tag.id}`}
                  data-held={held || undefined}
                  onClick={() =>
                    patch(held ? { revokeTag: tag.id } : { grantTag: tag.id }, held ? `Tag "${tag.label}" tirada.` : `Tag "${tag.label}" dada.`)
                  }
                >
                  <span
                    className="admin-tag-dot"
                    style={cssVariables({ '--tag-bg': tag.color, '--tag-fg': tagTextColor(tag.color) })}
                    aria-hidden="true"
                  />
                  {held ? `Tirar "${tag.label}"` : `Dar "${tag.label}"`}
                </Button>
              );
            })}
          </div>
        )}
        <p className="admin-hint">Tags com borda tracejada só aparecem aqui no admin. Valem para sempre, inclusive depois do reset de lançamento.</p>
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
