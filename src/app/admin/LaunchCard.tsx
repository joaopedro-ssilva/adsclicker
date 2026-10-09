'use client';
import { useState } from 'react';
import { LAUNCH_RESET_PHRASE } from '@/shared/api';
import type { AdminLaunchResetPreview, AdminLaunchResetResult, AdminTurmaZeroPreview, AdminTurmaZeroResult } from '@/shared/api';
import { api } from '@/shared/apiClient';
import { Button, Panel } from '@/ui/kit';
import { ActionResultText } from './ActionResultText';
import { useApiAction } from './useApiAction';

interface LaunchCardProps {
  /** Called after an action that changed players, so the list and totals reload. */
  onChanged: () => void;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The two launch-day tools: the bulk "Turma Zero" and the progress reset. Both ask before doing anything. */
export function LaunchCard({ onChanged }: LaunchCardProps) {
  const grant = useApiAction();
  const reset = useApiAction();
  const [turmaZero, setTurmaZero] = useState<AdminTurmaZeroPreview | null>(null);
  const [resetPreview, setResetPreview] = useState<AdminLaunchResetPreview | null>(null);
  const [phrase, setPhrase] = useState('');
  const [granted, setGranted] = useState<AdminTurmaZeroResult | null>(null);
  const [report, setReport] = useState<AdminLaunchResetResult | null>(null);

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

  const askReset = async () => {
    setReport(null);
    setPhrase('');
    const preview = await reset.run(() => api.admin.launchResetPreview(), 'Contagem atualizada.');
    if (preview) setResetPreview(preview);
  };
  const confirmReset = async () => {
    const done = await reset.run(() => api.admin.launchReset(phrase), 'Progresso zerado.');
    if (done) {
      setResetPreview(null);
      setPhrase('');
      setReport(done);
      onChanged();
    }
  };

  return (
    <Panel className="admin-card" data-qa="admin-launch-card">
      <div className="admin-card-head">
        <h2>Lançamento</h2>
      </div>

      <div className="admin-actions-group">
        <h4>Turma Zero</h4>
        <p className="muted">
          Dá o título &ldquo;Turma Zero&rdquo; a todo jogador com apelido que sincronizou ao menos uma vez. Faça isto antes de zerar o progresso.
        </p>
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

      <div className="admin-actions-group">
        <h4>Zerar progresso para o lançamento</h4>
        <p className="muted">
          Apaga o save na nuvem, o resumo de progresso, a posição no ranking, as marcas de suspeito, os totais da comunidade, o mural e o
          progresso do Hackathon de todos os jogadores. Mantém contas, apelidos, senhas, sessões e títulos. Aparelhos com um save antigo
          recomeçam do zero no próximo sync, sem voltar ao ranking.
        </p>
        <div className="admin-action-buttons">
          <Button size="sm" variant="danger" disabled={reset.busy} data-qa="admin-launch-reset" onClick={askReset}>
            Zerar progresso para o lançamento
          </Button>
        </div>
        {resetPreview ? (
          <div className="admin-confirm" role="alertdialog" aria-label="Confirmar o reset de lançamento" data-qa="admin-launch-reset-confirm">
            <p>
              Isto vai zerar {plural(resetPreview.players, 'jogador com progresso', 'jogadores com progresso')}, apagar{' '}
              {plural(resetPreview.feedEvents, 'evento do mural', 'eventos do mural')} e {plural(resetPreview.hackathonRows, 'linha', 'linhas')}{' '}
              do Hackathon. Não dá para desfazer.
            </p>
            {resetPreview.withoutTurmaZero > 0 ? (
              <p className="admin-warning" role="alert">
                {plural(resetPreview.withoutTurmaZero, 'jogador elegível ainda não tem', 'jogadores elegíveis ainda não têm')} o título Turma Zero.
                Depois do reset ninguém terá sincronizado, e o botão de Turma Zero não os encontrará mais. Dê o título antes.
              </p>
            ) : null}
            <label htmlFor="admin-launch-phrase">
              Para confirmar, digite <strong>{LAUNCH_RESET_PHRASE}</strong>
            </label>
            <input
              id="admin-launch-phrase"
              type="text"
              autoComplete="off"
              value={phrase}
              data-qa="admin-launch-phrase"
              onChange={(event) => setPhrase(event.target.value)}
            />
            <div className="admin-action-buttons">
              <Button
                size="sm"
                variant="danger"
                disabled={reset.busy || phrase.trim() !== LAUNCH_RESET_PHRASE}
                data-qa="admin-launch-reset-yes"
                onClick={confirmReset}
              >
                Zerar agora
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setResetPreview(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}
        {report ? (
          <p className="admin-result" role="status" data-tone="ok" data-qa="admin-launch-report">
            Pronto (época {report.epoch}): {report.players} contas atualizadas, {report.playersWithProgress} com progresso apagado,{' '}
            {report.feedEvents} eventos do mural; Hackathon: {report.hackathonProfiles} perfis, {report.hackathonItems} itens,{' '}
            {report.hackathonRuns} partidas, {report.hackathonStages} fases, {report.hackathonCollection} da coleção.
          </p>
        ) : null}
        <ActionResultText message={reset.message} />
      </div>
    </Panel>
  );
}
