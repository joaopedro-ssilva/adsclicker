'use client';
import { useState } from 'react';
import type { AdminTurmaZeroPreview, AdminTurmaZeroResult } from '@/shared/api';
import { api } from '@/shared/apiClient';
import { Button, Panel } from '@/ui/kit';
import { ActionResultText } from './ActionResultText';
import { useApiAction } from './useApiAction';

interface TurmaZeroCardProps {
  /** Called after an action that changed players, so the list and totals reload. */
  onChanged: () => void;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The bulk "Turma Zero" grant: it only adds a tag, never removes anything. It asks before doing anything. */
export function TurmaZeroCard({ onChanged }: TurmaZeroCardProps) {
  const grant = useApiAction();
  const [turmaZero, setTurmaZero] = useState<AdminTurmaZeroPreview | null>(null);
  const [granted, setGranted] = useState<AdminTurmaZeroResult | null>(null);

  const askTurmaZero = async () => {
    setGranted(null);
    const preview = await grant.run(() => api.admin.turmaZeroPreview(), 'Contagem atualizada.');
    if (preview) setTurmaZero(preview);
  };
  const confirmTurmaZero = async () => {
    setTurmaZero(null);
    const done = await grant.run(() => api.admin.grantTurmaZero(), 'Turma Zero concedido.');
    if (done) {
      setGranted(done);
      onChanged();
    }
  };

  return (
    <Panel className="admin-card" data-qa="admin-turma-zero-card">
      <div className="admin-card-head">
        <h2>Turma Zero</h2>
      </div>

      <div className="admin-actions-group">
        <p className="muted">Dá a tag &ldquo;Turma Zero&rdquo; a todo jogador com apelido que sincronizou ao menos uma vez. Só acrescenta a tag; não apaga nada.</p>
        <div className="admin-action-buttons">
          <Button size="sm" variant="primary" disabled={grant.busy} data-qa="admin-turma-zero" onClick={askTurmaZero}>
            Dar Turma Zero a todos os jogadores atuais
          </Button>
        </div>
        {turmaZero ? (
          <div className="admin-confirm" role="alertdialog" aria-label="Confirmar Turma Zero" data-qa="admin-turma-zero-confirm">
            <p>
              {turmaZero.toGrant === 0
                ? `Nada a fazer: os ${plural(turmaZero.eligible, 'jogador elegível já tem', 'jogadores elegíveis já têm')} o título.`
                : `Dar Turma Zero a ${plural(turmaZero.toGrant, 'jogador', 'jogadores')}? (${turmaZero.eligible} elegíveis, ${turmaZero.alreadyHave} já têm.)`}
            </p>
            <div className="admin-action-buttons">
              <Button size="sm" variant="primary" disabled={grant.busy || turmaZero.toGrant === 0} data-qa="admin-turma-zero-yes" onClick={confirmTurmaZero}>
                Sim, dar o título
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setTurmaZero(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}
        {granted ? (
          <p className="admin-result" role="status" data-tone="ok" data-qa="admin-turma-zero-report">
            Turma Zero concedido a {plural(granted.granted, 'jogador', 'jogadores')} ({granted.alreadyHad} já tinham).
          </p>
        ) : null}
        <ActionResultText message={grant.message} />
      </div>
    </Panel>
  );
}
