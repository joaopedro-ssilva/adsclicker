'use client';
import { formatNumber } from '@/game/engine/format';
import { api } from '@/shared/apiClient';
import type { AdminPlayer } from '@/shared/api';
import { Badge, Panel } from '@/ui/kit';
import { ActionResultText } from './ActionResultText';
import { MultiplierPicker } from './MultiplierPicker';
import { useApiAction } from './useApiAction';

interface BrowserCardProps {
  /** The player of this browser, or null when it has none (or the list has not loaded). */
  player: AdminPlayer | null;
  loading: boolean;
  onChanged: (player: AdminPlayer) => void;
}

const PRESETS = [1, 10, 50, 100] as const;

export function BrowserCard({ player, loading, onChanged }: BrowserCardProps) {
  const { busy, message, run } = useApiAction();

  const apply = async (value: number) => {
    if (!player) return;
    const done = await run(
      () => api.admin.patchPlayer(player.id, { multiplier: value }),
      `Multiplicador ×${formatNumber(value)} aplicado.`,
    );
    if (done) onChanged(done.player);
  };

  return (
    <Panel className="admin-card">
      <div className="admin-card-head">
        <h2>Este navegador</h2>
        {player ? (
          <Badge tone={player.multiplier === 1 ? 'neutral' : 'warn'}>
            {player.multiplier === 1 ? 'Normal' : `Teste ×${formatNumber(player.multiplier)}`}
          </Badge>
        ) : null}
      </div>
      {player ? (
        <>
          <p>
            Você joga como <strong>{player.nickname ?? 'convidado'}</strong>. O jogo aberto recebe o novo valor no próximo sync, em
            até 45 segundos.
          </p>
          <MultiplierPicker name="admin-self" presets={PRESETS} current={player.multiplier} busy={busy} onApply={apply} />
          <p className="admin-warning">
            Qualquer valor diferente de ×1 transforma este jogador em conta de teste: ele sai do ranking. Voltar para ×1 não o
            devolve sozinho; tire a marca de teste na lista abaixo.
          </p>
        </>
      ) : (
        <p className="muted">
          {loading
            ? 'Procurando o jogador deste navegador...'
            : 'Este navegador ainda não tem uma sessão de jogo. Abra o jogo uma vez, deixe sincronizar e volte aqui.'}
        </p>
      )}
      <ActionResultText message={message} />
    </Panel>
  );
}
