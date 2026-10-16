'use client';
import { useEffect } from 'react';
import { formatNumber } from '@/game/engine/format';
import type { LabItemView, LabMonitorView, LabOfferView, LabRewardsView, LabBenchView } from '@/game/engine/views';
import { content, useGame, useLabBenchView, useLabRewardsView } from '@/game/store';
import { Button } from '@/ui/kit';
import { ItemArt } from './ItemArt';
import { SLOT_LABEL, affixText, perSecond, splitLines } from './labFormat';

const KIND_LABEL: Record<LabOfferView['kind'], string> = { item: 'Item', buff: 'Buff', commits: 'Commits', repair: 'Reparo' };

/** Most affix lines a compact card writes out; the rest is counted ("+2"). */
const MAX_LINES = 3;

/** "Poder +3,2 sobre o atual" when the offer takes the place of an item already on the bench. */
function compareText(offer: LabOfferView): string | null {
  if (!offer.item || !offer.replaces) return null;
  const delta = offer.item.power - offer.replaces.power;
  const sign = delta < 0 ? '-' : '+';
  return `Poder ${sign}${perSecond(Math.abs(delta))} sobre ${offer.replaces.name}`;
}

/** Number keys 1..n pick the n-th choice while the decision is on the glass (the overlay owns the keys). */
function useNumberKeys(actions: readonly (() => void)[]): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      if (event.target instanceof HTMLElement && /^(input|textarea|select)$/i.test(event.target.tagName)) return;
      const slot = /^[1-9]$/.test(event.key) ? Number(event.key) - 1 : -1;
      const action = actions[slot];
      if (!action) return;
      event.preventDefault();
      action();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actions]);
}

/** The affix lines of an item, the clicker ones first, cut to what a compact card has room for. */
function ItemLines({ item }: { item: LabItemView }) {
  const lines = splitLines(content, item.affixes.flatMap((affix) => affix.lines));
  const all = [
    ...lines.clicker.map((line) => ({ line, scope: 'clicker' })),
    ...lines.lab.map((line) => ({ line, scope: 'lab' })),
  ];
  const shown = all.slice(0, MAX_LINES);
  return (
    <ul className="lab-pick-lines" title={all.map((entry) => affixText(entry.line)).join('; ')}>
      {shown.map((entry) => (
        <li key={`${entry.scope}-${entry.line.label}`} data-scope={entry.scope}>
          {affixText(entry.line)}
        </li>
      ))}
      {all.length > shown.length ? <li className="lab-pick-more">+{all.length - shown.length} atributo(s)</li> : null}
      {all.length === 0 ? <li className="lab-pick-more">Sem atributos: só dano.</li> : null}
      {item.unique?.active ? <li className="lab-pick-unique">Efeito lendário</li> : null}
    </ul>
  );
}

/** An item as the glass shows it: high-resolution art, name, rarity and level, power, a few lines. */
function PickItem({ item, tag }: { item: LabItemView; tag?: string }) {
  return (
    <div className="lab-pick-item" data-rarity={item.rarity}>
      {tag ? <p className="lab-pick-tag">{tag}</p> : null}
      <div className="lab-pick-head">
        <ItemArt asset={item.asset} name={item.name} size={60} />
        <div className="lab-pick-id">
          <p className="lab-pick-name" title={item.name}>
            {item.name}
          </p>
          <p className="lab-pick-meta">
            <b className="lab-rarity">{item.rarityName}</b>
            <span>
              Nv {item.level}/{item.maxLevel}
            </span>
          </p>
          <p className="lab-pick-power">
            Poder <b>{formatNumber(item.power)}</b>
          </p>
        </div>
      </div>
      <ItemLines item={item} />
    </div>
  );
}

function OfferCard({ offer, position, choose }: { offer: LabOfferView; position: number; choose: () => void }) {
  const compare = compareText(offer);
  return (
    <article className="lab-pick" data-kind={offer.kind} data-rarity={offer.item?.rarity} aria-label={`${KIND_LABEL[offer.kind]}: ${offer.title}`}>
      {offer.item ? (
        <>
          <PickItem item={offer.item} />
          <p className="lab-pick-compare">{compare ?? 'Slot livre: equipa na hora.'}</p>
        </>
      ) : (
        <div className="lab-pick-plain">
          <span className="lab-pick-emoji" aria-hidden="true">
            {offer.emoji}
          </span>
          <p className="lab-pick-name">{offer.title}</p>
          <p className="lab-pick-meta">
            <b>{KIND_LABEL[offer.kind]}</b>
          </p>
          <ul className="lab-pick-lines">
            {offer.lines.map((line) => (
              <li key={line.label} data-scope="clicker">
                {affixText(line)}
              </li>
            ))}
          </ul>
          <p className="lab-pick-compare">{offer.description}</p>
        </div>
      )}
      <Button size="sm" onClick={choose} data-qa={`lab-offer-${offer.index}`}>
        <kbd className="lab-pick-key">{position}</kbd> Escolher
      </Button>
    </article>
  );
}

/** The options after a cleared phase, drawn on the glass of the monitor. */
function Rewards({ view }: { view: LabRewardsView }) {
  const choose = useGame((store) => store.chooseLabReward);
  const picks = view.options.map((offer) => () => void choose(offer.index));
  useNumberKeys(picks);
  return (
    <section className="lab-pick-panel" aria-label="Recompensas" data-qa="lab-rewards">
      <header className="lab-pick-head-line">
        <h3>{view.boss ? 'Chefão derrotado' : `Fase ${view.phase} concluída`}</h3>
        <p>Escolha uma recompensa (teclas 1 a {view.options.length})</p>
      </header>
      <div className="lab-pick-grid" data-count={view.options.length}>
        {view.options.map((offer, i) => (
          <OfferCard key={offer.index} offer={offer} position={i + 1} choose={() => void choose(offer.index)} />
        ))}
      </div>
    </section>
  );
}

/** A new item for an occupied slot: the two side by side, then equip (the current one is recycled) or recycle the new one. */
function Compare({ pending }: { pending: NonNullable<LabBenchView['pending']> }) {
  const equip = useGame((store) => store.equipLabPending);
  const recycle = useGame((store) => store.recycleLabPending);
  const { item, replaces } = pending;
  const delta = replaces ? item.power - replaces.power : item.power;
  const picks = [() => void equip(), () => void recycle()];
  useNumberKeys(picks);

  return (
    <section className="lab-pick-panel lab-pick-compare-panel" aria-label="Novo item" data-qa="lab-compare">
      <header className="lab-pick-head-line">
        <h3>Item novo: {SLOT_LABEL[item.slot]}</h3>
        <p>
          Poder {delta < 0 ? '-' : '+'}
          {perSecond(Math.abs(delta))} se equipar
        </p>
      </header>
      <div className="lab-pick-grid" data-count={replaces ? 2 : 1}>
        <PickItem item={item} tag="Novo" />
        {replaces ? <PickItem item={replaces} tag="Atual" /> : null}
      </div>
      <div className="lab-pick-actions">
        <Button size="sm" onClick={picks[0]} data-qa="lab-equip">
          <kbd className="lab-pick-key">1</kbd> Equipar (recicla o atual{pending.recycleOld !== null ? `, +${formatNumber(pending.recycleOld, { integer: true })} Commits` : ''})
        </Button>
        <Button size="sm" variant="secondary" onClick={picks[1]} data-qa="lab-recycle">
          <kbd className="lab-pick-key">2</kbd> Reciclar o novo (+{formatNumber(pending.recycleNew, { integer: true })} Commits)
        </Button>
      </div>
    </section>
  );
}

/** What the glass shows while the run waits for a decision: the reward options, or the equip-or-recycle choice. */
export function ScreenDecision({ status }: { status: 'reward' | 'equip' }) {
  const rewards = useLabRewardsView();
  const bench = useLabBenchView();
  if (status === 'equip' && bench.pending) return <Compare pending={bench.pending} />;
  if (rewards.open) return <Rewards view={rewards} />;
  return null;
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
