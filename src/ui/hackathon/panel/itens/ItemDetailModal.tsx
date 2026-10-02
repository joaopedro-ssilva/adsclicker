import { useState } from 'react';
import { recycleValue, rerollCost } from '@/hackathon/engine';
import type { ItemInstance } from '@/hackathon/engine';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { useHackathon } from '@/ui/hackathon/store';
import { Button, Modal } from '@/ui/kit';
import { Commits } from '../lib/Commits';
import { ConfirmDialog } from '../lib/ConfirmDialog';
import { baseById, HK, setById } from '../lib/hk';
import { itemName, needsConfirmation } from '../lib/itemInfo';
import { ItemIcon } from '../lib/ItemIcon';
import { affixView, RARITY_NAME, SLOT_LABEL, whole } from '../lib/labels';
import { QualityBar } from '../lib/QualityBar';
import { RarityPips } from '../lib/RarityPips';
import { useBusy } from '../lib/useBusy';
import { InlineError, useAction } from '../lib/useAction';
import { AffixRow } from './AffixRow';
import { ItemCompare } from './ItemCompare';

interface ItemDetailModalProps {
  profile: HackathonProfile;
  /** The item to show, or null with the modal closed. */
  item: ItemInstance | null;
  onClose: () => void;
}

/** The detail of one item: affixes with quality, unique effect, set, comparison and the actions. */
export function ItemDetailModal({ profile, item, onClose }: ItemDetailModalProps) {
  const { locked } = useBusy();
  const { run: report, error } = useAction();
  const [rerolling, setRerolling] = useState<number | null>(null);
  const [recycling, setRecycling] = useState(false);

  const base = item ? baseById.get(item.base) : undefined;
  const equipped = item ? profile.equipped[base?.slot ?? 'ferramenta'] === item.id : false;
  const open = item !== null && base !== undefined;

  const price = item ? rerollCost(item, HK) : 0;
  const refund = item ? recycleValue(item, HK) : 0;
  const rerollBlock = locked ? 'Aguarde' : profile.commits < price ? `Faltam ${whole(price - profile.commits)} Commits` : null;
  const set = base?.set ? setById.get(base.set) : undefined;
  const wornInSet = set
    ? profile.items.filter((entry) => baseById.get(entry.base)?.set === set.id && profile.equipped[baseById.get(entry.base)?.slot ?? 'ferramenta'] === entry.id).length
    : 0;

  const toggleEquip = () => {
    if (!item || !base) return;
    void report(useHackathon.getState().equip(base.slot, equipped ? null : item.id));
  };

  const recycle = async () => {
    if (!item) return;
    setRecycling(false);
    const ok = await report(useHackathon.getState().recycle([item.id]), { title: 'Item reciclado', description: `+${refund} Commits`, tone: 'good' });
    if (ok) onClose();
  };

  const reroll = async () => {
    if (!item || rerolling === null) return;
    const index = rerolling;
    setRerolling(null);
    await report(useHackathon.getState().reroll(item.id, index), 'Atributo rerrolado.');
  };

  const rerollTarget = item && rerolling !== null ? item.affixes[rerolling] : undefined;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={item ? itemName(item) : 'Item'}
        footer={
          item && base ? (
            <>
              <Button
                variant="danger"
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
              <Button variant={equipped ? 'secondary' : 'primary'} disabled={locked} data-qa="hk-equip" onClick={toggleEquip}>
                {equipped ? 'Desequipar' : 'Equipar'}
              </Button>
            </>
          ) : undefined
        }
      >
        {item && base ? (
          <div className="hk-detail" data-rarity={item.rarity} data-qa="hk-detail">
            <header className="hk-detail-head">
              <span className="hk-frame hk-detail-frame" data-rarity={item.rarity}>
                <ItemIcon asset={base.asset} scale={3} />
              </span>
              <div className="hk-detail-title">
                <p className="hk-rarity-line">
                  <RarityPips rarity={item.rarity} />
                  <span>{RARITY_NAME[item.rarity]}</span>
                </p>
                <p className="hk-note">
                  {SLOT_LABEL[base.slot]} · nível {item.level}
                  {equipped ? ' · equipado' : ''}
                </p>
                <p className="hk-note">{base.description}</p>
              </div>
            </header>

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
              <h3>{item.rarity === 'lendario' ? 'Efeito único' : 'Efeito único (só no lendário)'}</h3>
              <p>{base.unique.description}</p>
            </div>

            {set ? (
              <div className="hk-itemset">
                <h3>
                  {set.name} <small>{wornInSet}/{HK.items.filter((entry) => entry.set === set.id).length} equipadas</small>
                </h3>
                <ul>
                  {set.bonuses.map((bonus) => (
                    <li key={bonus.pieces} data-on={wornInSet >= bonus.pieces}>
                      <b>{bonus.pieces} peças</b> {bonus.description}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {equipped ? <p className="hk-note">Este item está equipado, então não há o que comparar.</p> : <ItemCompare profile={profile} item={item} />}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={rerolling !== null && rerollTarget !== undefined}
        title="Rerrolar atributo"
        confirmLabel="Rerrolar"
        disabled={locked || profile.commits < price}
        confirmQa="hk-reroll-confirm"
        onConfirm={() => void reroll()}
        onCancel={() => setRerolling(null)}
      >
        <p>
          Sortear de novo <strong>{rerollTarget ? affixView(rerollTarget).label : ''}</strong> em {item ? itemName(item) : ''} por <strong>{whole(price)} Commits</strong>.
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
          {item ? itemName(item) : ''} ({item ? RARITY_NAME[item.rarity] : ''}) será destruído em troca de <strong>{refund} Commits</strong>. Não dá para desfazer.
        </p>
      </ConfirmDialog>
    </>
  );
}
