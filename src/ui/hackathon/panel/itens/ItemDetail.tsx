import { useState } from 'react';
import { recycleValue, rerollCost } from '@/hackathon/engine';
import type { ItemInstance } from '@/hackathon/engine';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { useHackathon } from '@/ui/hackathon/store';
import { Button } from '@/ui/kit';
import { Commits } from '../lib/Commits';
import { ConfirmDialog } from '../lib/ConfirmDialog';
import { baseById, HK } from '../lib/hk';
import { itemName, needsConfirmation } from '../lib/itemInfo';
import { ItemIcon } from '../lib/ItemIcon';
import { affixView, RARITY_NAME, SLOT_LABEL, whole } from '../lib/labels';
import { QualityBar } from '../lib/QualityBar';
import { RarityPips } from '../lib/RarityPips';
import { useBusy } from '../lib/useBusy';
import { InlineError, useAction } from '../lib/useAction';
import { AffixRow } from './AffixRow';
import { ItemCompare } from './ItemCompare';
import { ItemSetInfo } from './ItemSetInfo';

interface ItemDetailProps {
  profile: HackathonProfile;
  item: ItemInstance;
  /** The pane repeats the name in its head; the modal already has it as its title. */
  showName: boolean;
  /** The item is gone (recycled): the caller closes the modal or clears the pane. */
  onGone: () => void;
}

/** One item in full: affixes with quality and reroll, unique effect, set, comparison and the actions. */
export function ItemDetail({ profile, item, showName, onGone }: ItemDetailProps) {
  const { locked } = useBusy();
  const { run: report, error } = useAction();
  const [rerolling, setRerolling] = useState<number | null>(null);
  const [recycling, setRecycling] = useState(false);

  const base = baseById.get(item.base);
  if (!base) return null;
  const equipped = profile.equipped[base.slot] === item.id;
  const price = rerollCost(item, HK);
  const refund = recycleValue(item, HK);
  const rerollBlock = locked ? 'Aguarde' : profile.commits < price ? `Faltam ${whole(price - profile.commits)} Commits` : null;
  const rerollTarget = rerolling !== null ? item.affixes[rerolling] : undefined;

  const toggleEquip = () => void report(useHackathon.getState().equip(base.slot, equipped ? null : item.id));

  const recycle = async () => {
    setRecycling(false);
    const ok = await report(useHackathon.getState().recycle([item.id]), { title: 'Item reciclado', description: `+${refund} Commits`, tone: 'good' });
    if (ok) onGone();
  };

  const reroll = async () => {
    if (rerolling === null) return;
    const index = rerolling;
    setRerolling(null);
    await report(useHackathon.getState().reroll(item.id, index), 'Atributo rerrolado.');
  };

  return (
    <div className="hk-detail" data-rarity={item.rarity} data-qa="hk-detail">
      <div className="hk-detail-scroll">
        <header className="hk-detail-head">
          <span className="hk-frame hk-detail-frame" data-rarity={item.rarity}>
            <ItemIcon asset={base.asset} scale={3} />
          </span>
          <div className="hk-detail-title">
            {showName ? <h3 className="hk-detail-name">{itemName(item)}</h3> : null}
            <p className="hk-rarity-tag">
              <RarityPips rarity={item.rarity} />
              {RARITY_NAME[item.rarity]}
            </p>
            <p className="hk-detail-level">Nível {item.level}</p>
          </div>
        </header>
        <dl className="hk-detail-facts">
          <div>
            <dt>Categoria</dt>
            <dd>{SLOT_LABEL[base.slot]}</dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd data-tone={equipped ? 'good' : undefined}>{equipped ? 'Equipado' : 'No inventário'}</dd>
          </div>
        </dl>
        <p className="hk-note">{base.description}</p>

        <InlineError message={error} />

        <div className="hk-overall">
          <span>Qualidade geral</span>
          <b>{Math.round(item.quality)}/100</b>
          <QualityBar value={item.quality} label="Qualidade geral" />
        </div>

        <ul className="hk-affixes">
          {item.affixes.map((affix, index) => (
            <AffixRow key={`${affix.target}-${affix.op}`} affix={affix} index={index} price={price} blocked={rerollBlock} onReroll={setRerolling} />
          ))}
        </ul>
        {item.rerolls > 0 ? <p className="hk-note">Rerrolado {item.rerolls} {item.rerolls === 1 ? 'vez' : 'vezes'}: cada nova rerrolagem custa o dobro.</p> : null}

        <div className="hk-unique" data-on={item.rarity === 'lendario'}>
          <h4>{item.rarity === 'lendario' ? 'Efeito único' : 'Efeito único (só no lendário)'}</h4>
          <p>{base.unique.description}</p>
        </div>

        <ItemSetInfo profile={profile} setId={base.set} />

        {equipped ? <p className="hk-note">Este item está equipado, então não há o que comparar.</p> : <ItemCompare profile={profile} item={item} />}
      </div>

      <footer className="hk-detail-actions">
        <Button variant={equipped ? 'secondary' : 'primary'} disabled={locked} data-qa="hk-equip" onClick={toggleEquip}>
          {equipped ? 'Desequipar' : 'Equipar'}
        </Button>
        <Button
          variant="secondary"
          className="hk-recycle"
          aria-disabled={equipped || locked}
          title={equipped ? 'Desequipe antes de reciclar' : undefined}
          data-qa="hk-recycle"
          onClick={() => {
            if (equipped || locked) return;
            if (needsConfirmation(item.rarity)) setRecycling(true);
            else void recycle();
          }}
        >
          Reciclar <Commits amount={refund} />
        </Button>
      </footer>

      <ConfirmDialog
        open={rerollTarget !== undefined}
        title="Rerrolar atributo"
        confirmLabel="Rerrolar"
        disabled={locked || profile.commits < price}
        confirmQa="hk-reroll-confirm"
        onConfirm={() => void reroll()}
        onCancel={() => setRerolling(null)}
      >
        <p>
          Sortear de novo <strong>{rerollTarget ? affixView(rerollTarget).label : ''}</strong> em {itemName(item)} por <strong>{whole(price)} Commits</strong>.
        </p>
        <p className="hk-reason">O valor atual some e o novo pode ser pior. O próximo rerrolo deste item custará {whole(price * 2)}.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={recycling}
        title="Reciclar item"
        confirmLabel="Reciclar"
        danger
        disabled={locked}
        confirmQa="hk-recycle-confirm"
        onConfirm={() => void recycle()}
        onCancel={() => setRecycling(false)}
      >
        <p>
          {itemName(item)} ({RARITY_NAME[item.rarity]}) será destruído em troca de <strong>{refund} Commits</strong>. Não dá para desfazer.
        </p>
      </ConfirmDialog>
    </div>
  );
}
