'use client';
import { formatNumber } from '@/game/engine/format';
import type { LabBenchView, LabItemView } from '@/game/engine/views';
import { useGame } from '@/game/store';
import type { LabSlot } from '@/game/content/labTypes';
import { Button } from '@/ui/kit';
import { ItemBody, LineList } from './ItemCard';
import { SLOT_HINT, SLOT_LABEL, perSecond } from './labFormat';

const coins = (value: Parameters<typeof formatNumber>[0]) => formatNumber(value);

function SlotLabel({ slot }: { slot: LabSlot }) {
  return (
    <p className="lab-slot-title">
      <b>{SLOT_LABEL[slot]}</b>
      <span>{SLOT_HINT[slot]}</span>
    </p>
  );
}

function SlotCard({ slot, item, enabled }: { slot: LabSlot; item: LabItemView | null; enabled: boolean }) {
  const levelUp = useGame((store) => store.levelUpLabItem);
  const reroll = useGame((store) => store.rerollLabAffix);

  return (
    <li className="lab-slot-card" data-filled={item !== null} data-qa={`lab-slot-${slot}`}>
      {item ? (
        <ItemBody
          item={item}
          label={<SlotLabel slot={slot} />}
          affixAction={(affix) => (
            <Button
              size="sm"
              variant="secondary"
              className="lab-reroll"
              disabled={!affix.canReroll}
              data-qa={`lab-reroll-${slot}-${affix.index}`}
              aria-label={`Sortear o atributo ${affix.index + 1} de ${item.name} por ${coins(affix.rerollCost)} ADScoins`}
              onClick={() => void reroll(slot, affix.index)}
            >
              Sortear
              <small>{coins(affix.rerollCost)}</small>
            </Button>
          )}
        >
          <div className="lab-item-actions">
            <Button
              size="sm"
              disabled={!item.canLevelUp}
              data-qa={`lab-levelup-${slot}`}
              aria-label={
                item.levelUpCost ? `Subir o nível de ${item.name} por ${coins(item.levelUpCost)} ADScoins` : `${item.name} está no nível máximo`
              }
              onClick={() => void levelUp(slot)}
            >
              {item.levelUpCost ? 'Subir nível' : 'Nível máximo'}
              {item.levelUpCost ? <small>{coins(item.levelUpCost)}</small> : null}
            </Button>
          </div>
        </ItemBody>
      ) : (
        <div className="lab-slot-empty">
          <SlotLabel slot={slot} />
          <p>{enabled ? 'Vazio. Os itens vêm da pesquisa.' : 'Indisponível nesta turma.'}</p>
        </div>
      )}
    </li>
  );
}

/** The left column: what the equipped items add to the clicker and the lab, and the run buffs. */
export function Summary({ view }: { view: LabBenchView }) {
  const enabled = view.available.ok;
  return (
    <section className="lab-panel lab-area-summary" aria-label="Bancada" data-qa="lab-bench">
      <header className="lab-section-head">
        <h3>Bancada</h3>
      </header>
      <p className="lab-summary-totals">
        Poder <b>{formatNumber(view.power)}</b> · Dano <b>{perSecond(view.autoDps)}</b>/s
      </p>

      {!enabled ? (
        <p className="lab-note" data-tone="warn">
          Inventário bloqueado: {view.available.reason?.toLowerCase() ?? 'indisponível'}. Suba cada aula ao nível 1 para ligar o monitor.
        </p>
      ) : null}

      <div className="lab-summary-block">
        <p className="lab-summary-title">No clicker</p>
        {view.clicker.length > 0 ? (
          <LineList lines={view.clicker} />
        ) : (
          <p className="lab-item-note">Os itens equipados reforçam o clicker até a formatura.</p>
        )}
      </div>
      {view.effects.length > 0 ? (
        <div className="lab-summary-block">
          <p className="lab-summary-title">No laboratório</p>
          <LineList lines={view.effects} />
        </div>
      ) : null}
      {view.buffs.length > 0 ? (
        <div className="lab-summary-block">
          <p className="lab-summary-title">Buffs da pesquisa</p>
          <ul className="lab-buffs">
            {view.buffs.map((buff) => (
              <li key={buff.id} title={buff.description} data-qa={`lab-buff-${buff.id}`}>
                <span aria-hidden="true">{buff.emoji}</span> {buff.name}
                {buff.count > 1 ? <b> ×{buff.count}</b> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

/** The middle column: the four slots as a 2x2 grid of compact cards. */
export function Equipment({ view }: { view: LabBenchView }) {
  const enabled = view.available.ok;
  const equipped = view.slots.filter((entry) => entry.item !== null).length;
  return (
    <section className="lab-panel lab-area-equipment" aria-label="Equipamentos">
      <header className="lab-section-head">
        <h3>Equipamentos</h3>
        <p>
          {equipped} / {view.slots.length} equipados · custos em ADScoins
        </p>
      </header>
      <ul className="lab-slots">
        {view.slots.map(({ slot, item }) => (
          <SlotCard key={slot} slot={slot} item={item} enabled={enabled} />
        ))}
      </ul>
    </section>
  );
}
