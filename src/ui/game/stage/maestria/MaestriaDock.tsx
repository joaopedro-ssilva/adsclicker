'use client';
import { formatDuration, formatNumber } from '@/game/engine/format';
import { festaText } from '@/game/engine/views';
import { useBolsaView, useFestaView, useGame, useRollforwardView, useSwarmView } from '@/game/store';
import type { BolsaView, FestaView, RollforwardView, SwarmView } from '@/game/engine/views';
import { Meter, Tooltip } from '@/ui/kit';
import { LayerReveal } from '../LayerReveal';
import { useBolsaPanel } from './bolsa/bolsaPanelStore';

function RollforwardButton({ view }: { view: RollforwardView }) {
  const fire = useGame((store) => store.fireRollforward);
  const full = view.charges >= view.maxCharges;
  const state = view.ready ? 'ready' : 'cooldown';
  const caption = view.ready ? `Pronto ×${view.charges}` : `${view.clicks}/${view.toFill}`;

  return (
    <Tooltip
      content={`Rollforward: ${view.toFill} cliques enchem uma carga; ela avança o jogo ${formatDuration(view.jumpMs)}: as ADScoins do período chegam de uma vez e as recargas andam junto. Guarda até ${view.maxCharges}.`}
    >
      <button
        type="button"
        className="ability maestria-button"
        data-qa="rollforward"
        data-state={state}
        disabled={!view.ready}
        onClick={() => void fire()}
        aria-label={`Rollforward, ${view.charges} de ${view.maxCharges} cargas, ${view.ready ? 'pronto' : `${view.clicks} de ${view.toFill} cliques`}`}
      >
        <Meter value={full ? 1 : view.clicks} max={full ? 1 : view.toFill} label="Rollforward" size="md" showLabel={false}>
          <span aria-hidden="true">⏩</span>
        </Meter>
        <span className="ability-name">Rollforward</span>
        <span className="ability-caption">{caption}</span>
        {view.maxCharges > 1 ? (
          <span className="maestria-pips" aria-hidden="true">
            {Array.from({ length: view.maxCharges }, (_, index) => (
              <i key={index} data-on={index < view.charges} />
            ))}
          </span>
        ) : null}
      </button>
    </Tooltip>
  );
}

function SwarmButton({ view }: { view: SwarmView }) {
  const start = useGame((store) => store.startSwarm);
  const running = view.active !== null;
  const state = running ? 'running' : view.ready ? 'ready' : 'cooldown';
  const caption = running ? 'Em curso' : view.ready ? 'Pronto' : formatDuration(view.chargeLeftMs);

  return (
    <Tooltip content="Super invasão: um enxame de bugs toma o palco por 45 s, com um chefe perto do fim. Quanto mais derrotados, maior o prêmio. Carrega com o tempo, uma vez por hora.">
      <button
        type="button"
        className="ability maestria-button"
        data-qa="swarm-start"
        data-state={state}
        disabled={!view.ready}
        onClick={() => void start()}
        aria-label={`Super invasão, ${caption}`}
      >
        <Meter value={running || view.ready ? 1 : view.charge} max={1} label="Super invasão" size="md" showLabel={false}>
          <span aria-hidden="true">🐛</span>
        </Meter>
        <span className="ability-name">Super invasão</span>
        <span className="ability-caption">{caption}</span>
      </button>
    </Tooltip>
  );
}

function FestaButton({ view }: { view: FestaView }) {
  const start = useGame((store) => store.startFesta);
  const running = view.active !== null;
  const state = running ? 'running' : view.ready ? 'ready' : 'cooldown';
  const caption = running ? formatDuration(view.active?.leftMs ?? 0) : view.ready ? 'Pronta' : formatDuration(view.chargeLeftMs);

  return (
    <Tooltip content={`Festa de lançamento: ${festaText(view)}`}>
      <button
        type="button"
        className="ability maestria-button"
        data-qa="festa-start"
        data-state={state}
        disabled={!view.ready}
        onClick={() => void start()}
        aria-label={`Festa de lançamento, ${caption}`}
      >
        <Meter value={running || view.ready ? 1 : view.charge} max={1} label="Festa de lançamento" size="md" showLabel={false}>
          <span aria-hidden="true">🎉</span>
        </Meter>
        <span className="ability-name">Festa de lançamento</span>
        <span className="ability-caption">{caption}</span>
      </button>
    </Tooltip>
  );
}

function BolsaButton({ view }: { view: BolsaView }) {
  const open = useBolsaPanel((store) => store.show);
  const held = view.totalValue.gt(0);
  const caption = held ? `${formatNumber(view.totalValue, { integer: true })} Oc` : 'Abrir';

  return (
    <Tooltip content="Bolsa de tokens: compre ativos de IA com ADScoins e venda quando o preço subir. Tem também um fundo lento e seguro.">
      <button
        type="button"
        className="ability maestria-button"
        data-qa="bolsa-open"
        data-state={held ? 'running' : 'ready'}
        onClick={open}
        aria-label={`Abrir a Bolsa de tokens, ${caption}`}
      >
        <Meter value={view.limit.gt(0) ? Math.min(1, view.invested.div(view.limit).toNumber()) : 0} max={1} label="Bolsa de tokens" size="md" showLabel={false}>
          <span aria-hidden="true">📈</span>
        </Meter>
        <span className="ability-name">Bolsa de tokens</span>
        <span className="ability-caption">{caption}</span>
      </button>
    </Tooltip>
  );
}

/**
 * The buttons of the Maestrias that need the player to press them. Gladimir's Rollforward and Wagner's Super invasão
 * sit bottom left; Guto's Festa de lançamento and Pablo's Bolsa sit bottom right, under the abilities.
 */
export function MaestriaDock() {
  const roll = useRollforwardView();
  const swarm = useSwarmView();
  const festa = useFestaView();
  const bolsa = useBolsaView();

  return (
    <>
      {roll || swarm ? (
        <LayerReveal layer="maestrias" className="maestria-dock">
          <div className="abilities" role="group" aria-label="Maestrias">
            {roll ? <RollforwardButton view={roll} /> : null}
            {swarm ? <SwarmButton view={swarm} /> : null}
          </div>
        </LayerReveal>
      ) : null}
      {festa || bolsa ? (
        <LayerReveal layer="maestrias-2" className="maestria-dock maestria-dock-right">
          <div className="abilities" role="group" aria-label="Maestrias de Guto e Pablo">
            {festa ? <FestaButton view={festa} /> : null}
            {bolsa ? <BolsaButton view={bolsa} /> : null}
          </div>
        </LayerReveal>
      ) : null}
    </>
  );
}
