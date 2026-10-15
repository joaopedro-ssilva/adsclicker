'use client';
import { formatNumber } from '@/game/engine/format';
import type { LabBenchView, LabMonitorView, LabOfferView, LabRewardsView } from '@/game/engine/views';
import { useGame } from '@/game/store';
import { Button } from '@/ui/kit';
import { ItemBody, LineList } from './ItemCard';
import { SLOT_LABEL, perSecond } from './labFormat';

const KIND_LABEL: Record<LabOfferView['kind'], string> = { item: 'Item', buff: 'Buff', commits: 'Commits', repair: 'Reparo' };

/** "Poder +3,2 sobre o atual" when the offer takes the place of an item already on the bench. */
function compareText(offer: LabOfferView): string | null {
  if (!offer.item || !offer.replaces) return null;
  const delta = offer.item.power - offer.replaces.power;
  const sign = delta < 0 ? '-' : '+';
  return `Substitui ${offer.replaces.name}: poder ${sign}${perSecond(Math.abs(delta))}`;
}

function OfferCard({ offer }: { offer: LabOfferView }) {
  const choose = useGame((store) => store.chooseLabReward);
  const compare = compareText(offer);
  const action = (
    <Button size="sm" onClick={() => void choose(offer.index)} data-qa={`lab-offer-${offer.index}`}>
      Escolher
    </Button>
  );

  return (
    <article className="lab-offer" data-kind={offer.kind} data-rarity={offer.item?.rarity} aria-label={`${KIND_LABEL[offer.kind]}: ${offer.title}`}>
      {offer.item ? (
        <ItemBody item={offer.item} variant="row" art={64}>
          <div className="lab-offer-foot">
            <p className="lab-offer-compare">{compare ?? 'Slot livre: equipa na hora.'}</p>
            {action}
          </div>
        </ItemBody>
      ) : (
        <div className="lab-offer-plain">
          <span className="lab-offer-emoji" aria-hidden="true">
            {offer.emoji}
          </span>
          <div className="lab-offer-main">
            <p className="lab-item-name">{offer.title}</p>
            {offer.lines.length > 0 ? <LineList lines={offer.lines} /> : null}
            <p className="lab-offer-text">{offer.description}</p>
            <div className="lab-offer-foot">{action}</div>
          </div>
        </div>
      )}
    </article>
  );
}

/** The options after a cleared phase. */
export function Rewards({ view }: { view: LabRewardsView }) {
  return (
    <section className="lab-decision" aria-label="Recompensas" data-qa="lab-rewards">
      <header className="lab-section-head">
        <h3>{view.boss ? 'Chefão derrotado' : `Fase ${view.phase} concluída`}</h3>
        <p>Escolha uma recompensa</p>
      </header>
      <div className="lab-offers" data-count={view.options.length}>
        {view.options.map((offer) => (
          <OfferCard key={offer.index} offer={offer} />
        ))}
      </div>
    </section>
  );
}

/** A new item for an occupied slot: the two side by side, then equip (the current one is recycled) or recycle the new one. */
export function Compare({ pending }: { pending: NonNullable<LabBenchView['pending']> }) {
  const equip = useGame((store) => store.equipLabPending);
  const recycle = useGame((store) => store.recycleLabPending);
  const { item, replaces } = pending;
  const delta = replaces ? item.power - replaces.power : item.power;

  return (
    <section className="lab-decision lab-compare" aria-label="Novo item" data-qa="lab-compare">
      <header className="lab-section-head">
        <h3>Item novo para o slot {SLOT_LABEL[item.slot]}</h3>
        <p>
          Poder {delta < 0 ? '-' : '+'}
          {perSecond(Math.abs(delta))} se equipar
        </p>
      </header>
      <div className="lab-compare-grid">
        <div>
          <p className="lab-compare-tag" data-tone="new">
            Novo
          </p>
          <ItemBody item={item} variant="row" art={64} />
        </div>
        {replaces ? (
          <div>
            <p className="lab-compare-tag">Atual</p>
            <ItemBody item={replaces} variant="row" art={64} />
          </div>
        ) : null}
        <div className="lab-compare-actions">
          <Button onClick={() => void equip()} data-qa="lab-equip">
            Equipar (recicla o atual{pending.recycleOld !== null ? `, +${formatNumber(pending.recycleOld, { integer: true })} Commits` : ''})
          </Button>
          <Button variant="secondary" onClick={() => void recycle()} data-qa="lab-recycle">
            Reciclar o novo (+{formatNumber(pending.recycleNew, { integer: true })} Commits)
          </Button>
        </div>
      </div>
    </section>
  );
}

/** While the fight runs: what the screen cannot say about the damage. */
export function FightNote({ view }: { view: LabMonitorView }) {
  return (
    <section className="lab-decision lab-fight-note" aria-label="Dano">
      <p>
        Dano automático <b>{perSecond(view.autoDps)}</b>/s · cada clique no monitor causa <b>{perSecond(view.clickDamage)}</b> (até{' '}
        {view.clicksPerSecond} por segundo, no máximo <b>+{perSecond(view.clickDpsCap)}</b>/s).
      </p>
      <p className="lab-center-fine">A pesquisa só anda com esta tela aberta. O clicker continua rodando por baixo.</p>
    </section>
  );
}
