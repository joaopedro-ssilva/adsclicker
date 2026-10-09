'use client';
import { formatNumber } from '@/game/engine/format';
import type { BolsaAssetView, BolsaView } from '@/game/engine/views';
import { useBolsaView, useGame } from '@/game/store';
import { Badge, Button, Modal, ProgressBar } from '@/ui/kit';
import { Sparkline } from './Sparkline';
import { useBolsaPanel } from './bolsaPanelStore';

const price = (value: number) => value.toFixed(2).replace('.', ',');
const percent = (value: number) => `${value >= 0 ? '+' : '−'}${Math.abs(value * 100).toFixed(1).replace('.', ',')}%`;
const coins = (value: Parameters<typeof formatNumber>[0]) => formatNumber(value, { integer: true });

const TEMPERAMENT = { calm: 'Calma', cyclic: 'Cíclico', spiky: 'Nervoso' } as const;

interface TradeProps {
  id: string;
  /** What 'Comprar' spends: a share of the room under the limit. */
  canBuy: boolean;
  canSell: boolean;
  onBuy: (fraction: number) => void;
  onSell: (fraction: number) => void;
}

function Trade({ id, canBuy, canSell, onBuy, onSell }: TradeProps) {
  return (
    <div className="bolsa-trade">
      <div className="bolsa-trade-group" role="group" aria-label="Comprar">
        <span className="bolsa-trade-label">Comprar</span>
        <Button size="sm" variant="secondary" disabled={!canBuy} data-qa={`bolsa-buy-${id}-25`} onClick={() => onBuy(0.25)}>
          25%
        </Button>
        <Button size="sm" variant="primary" disabled={!canBuy} data-qa={`bolsa-buy-${id}-max`} onClick={() => onBuy(1)}>
          Máx
        </Button>
      </div>
      <div className="bolsa-trade-group" role="group" aria-label="Vender">
        <span className="bolsa-trade-label">Vender</span>
        <Button size="sm" variant="secondary" disabled={!canSell} data-qa={`bolsa-sell-${id}-half`} onClick={() => onSell(0.5)}>
          Metade
        </Button>
        <Button size="sm" variant="secondary" disabled={!canSell} data-qa={`bolsa-sell-${id}-all`} onClick={() => onSell(1)}>
          Tudo
        </Button>
      </div>
    </div>
  );
}

function Holding({ value, cost, held }: { value: BolsaAssetView['value']; cost: BolsaAssetView['cost']; held: boolean }) {
  if (!held) return <p className="bolsa-hold bolsa-hold-empty">Sem posição</p>;
  const profit = value.sub(cost);
  const up = profit.gte(0);
  return (
    <p className="bolsa-hold">
      <b>{coins(value)}</b> Oc
      <span className="bolsa-profit" data-up={up}>
        {up ? '+' : '−'}
        {coins(profit.abs())}
      </span>
    </p>
  );
}

function AssetRow({ asset, view }: { asset: BolsaAssetView; view: BolsaView }) {
  const buy = useGame((store) => store.buyBolsaAsset);
  const sell = useGame((store) => store.sellBolsaAsset);
  const coinsInHand = useGame((store) => store.state.coins);
  const canBuy = asset.open && view.room.gte(1) && coinsInHand.gte(1);

  return (
    <li className="bolsa-row" data-open={asset.open} data-qa={`bolsa-asset-${asset.id}`}>
      <div className="bolsa-id">
        <span className="bolsa-emoji" aria-hidden="true">
          {asset.emoji}
        </span>
        <div>
          <p className="bolsa-name">
            {asset.name} <Badge tone={asset.temperament === 'calm' ? 'good' : asset.temperament === 'cyclic' ? 'accent' : 'warn'}>{TEMPERAMENT[asset.temperament]}</Badge>
          </p>
          <p className="bolsa-blurb">{asset.open ? asset.blurb : `Abre no nível ${asset.unlockLevel} da Maestria.`}</p>
        </div>
      </div>
      <div className="bolsa-quote">
        <Sparkline values={asset.history} lo={asset.lo} hi={asset.hi} label={`Preço de ${asset.name}, últimos passos`} />
        <p className="bolsa-price" data-qa={`bolsa-price-${asset.id}`}>
          <b>{price(asset.price)}</b>
          <span data-up={asset.change >= 0}>{percent(asset.change)}</span>
        </p>
      </div>
      <Holding value={asset.value} cost={asset.cost} held={asset.held} />
      {asset.open ? (
        <Trade
          id={asset.id}
          canBuy={canBuy}
          canSell={asset.held}
          onBuy={(fraction) => void buy(asset.id, fraction)}
          onSell={(fraction) => void sell(asset.id, fraction)}
        />
      ) : null}
    </li>
  );
}

function FundRow({ view }: { view: BolsaView }) {
  const deposit = useGame((store) => store.depositBolsaFund);
  const withdraw = useGame((store) => store.withdrawBolsaFund);
  const coinsInHand = useGame((store) => store.state.coins);
  const { fund } = view;

  return (
    <li className="bolsa-row bolsa-row-fund" data-open="true" data-qa="bolsa-asset-fundo">
      <div className="bolsa-id">
        <span className="bolsa-emoji" aria-hidden="true">
          🏦
        </span>
        <div>
          <p className="bolsa-name">
            Fundo <Badge tone="good">Seguro</Badge>
          </p>
          <p className="bolsa-blurb">Só sobe, devagar: {(fund.ratePerMinute * 100).toFixed(2).replace('.', ',')}% por minuto. Para quem não quer ficar olhando.</p>
        </div>
      </div>
      <div className="bolsa-quote">
        <p className="bolsa-price" data-qa="bolsa-price-fundo">
          <b>{price(fund.index)}</b>
          <span data-up="true">só sobe</span>
        </p>
      </div>
      <Holding value={fund.value} cost={fund.cost} held={fund.held} />
      <Trade
        id="fundo"
        canBuy={view.room.gte(1) && coinsInHand.gte(1)}
        canSell={fund.held}
        onBuy={(fraction) => void deposit(fraction)}
        onSell={(fraction) => void withdraw(fraction)}
      />
    </li>
  );
}

/**
 * Pablo's Bolsa de tokens: a compact panel with each asset's price and recent history, what the player holds, and buy and
 * sell. It opens from the stage button and from the Maestria card.
 */
export function BolsaPanel() {
  const open = useBolsaPanel((store) => store.open);
  const close = useBolsaPanel((store) => store.close);
  const view = useBolsaView();

  return (
    <Modal
      open={open && view !== null}
      onClose={close}
      title="Bolsa de tokens"
      size="lg"
      footer={
        <Button onClick={close} data-qa="bolsa-close">
          Fechar
        </Button>
      }
    >
      {view ? (
        <div className="bolsa" data-qa="bolsa-panel">
          <div className="bolsa-limits">
            <ProgressBar
              label="Investido"
              value={view.limit.gt(0) ? view.invested.div(view.limit).toNumber() : 0}
              max={1}
              valueLabel={`${coins(view.invested)} / ${coins(view.limit)} Oc (${formatNumber(view.limitMinutes, { integer: true })} min de produção)`}
              segmented
              segments={24}
              size="sm"
            />
            <ProgressBar
              label="Liquidez do mercado"
              value={view.liquidity}
              max={1}
              valueLabel={`${Math.round(view.liquidity * 100)}%`}
              segmented
              segments={24}
              size="sm"
              tone={view.liquidity < 0.15 ? 'warn' : 'good'}
            />
          </div>
          <p className="bolsa-note">
            O mercado paga o lucro até a liquidez acabar, e ela volta aos poucos. O que você investiu sempre volta. Ao se formar, tudo é
            vendido pelo preço do momento.
          </p>
          <ul className="bolsa-list">
            {view.assets.map((asset) => (
              <AssetRow key={asset.id} asset={asset} view={view} />
            ))}
            <FundRow view={view} />
          </ul>
        </div>
      ) : null}
    </Modal>
  );
}
