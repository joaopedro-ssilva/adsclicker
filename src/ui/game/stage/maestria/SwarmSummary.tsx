'use client';
import { formatDuration, formatNumber } from '@/game/engine/format';
import { Button, Modal } from '@/ui/kit';
import { useSwarmSummary } from './swarmSummaryStore';

/** What the last Super invasão paid: bugs defeated, the boss, the clear bonus and the coins. */
export function SwarmSummary() {
  const summary = useSwarmSummary((store) => store.summary);
  const close = useSwarmSummary((store) => store.close);

  return (
    <Modal
      open={summary !== null}
      onClose={close}
      title={summary?.cleared ? 'Enxame limpo!' : 'Fim da Super invasão'}
      size="sm"
      footer={
        <Button onClick={close} data-qa="swarm-close">
          Fechar
        </Button>
      }
    >
      {summary ? (
        <div className="swarm-summary" data-qa="swarm-summary">
          <dl>
            <div>
              <dt>Bugs derrotados</dt>
              <dd>
                {summary.defeated}/{summary.total}
              </dd>
            </div>
            <div>
              <dt>Deploy de sexta</dt>
              <dd>{summary.bossDefeated ? 'Derrotado' : 'Escapou'}</dd>
            </div>
            <div>
              <dt>Prêmio</dt>
              <dd>
                +{formatNumber(summary.coins, { integer: true })} <small>ADScoins</small>
              </dd>
            </div>
          </dl>
          <p className="muted">
            {summary.seconds > 0
              ? `Vale ${formatDuration(summary.seconds * 1000)} da produção da turma.`
              : 'Nenhum bug caiu desta vez.'}
            {summary.cleared ? ' Com o bônus de enxame limpo.' : ''}
          </p>
        </div>
      ) : null}
    </Modal>
  );
}
