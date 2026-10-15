'use client';
import { formatNumber } from '@/game/engine/format';
import type { LabBenchView, LabItemView } from '@/game/engine/views';
import { useGame } from '@/game/store';
import type { LabSlot } from '@/game/content/labTypes';
import { Button } from '@/ui/kit';
import { ItemBody, LineList } from './ItemCard';
import { SLOT_HINT, SLOT_LABEL, perSecond } from './labFormat';

const coins = (value: Parameters<typeof formatNumber>[0]) => formatNumber(value);

function SlotCard({ slot, item, enabled }: { slot: LabSlot; item: LabItemView | null; enabled: boolean }) {
  const levelUp = useGame((store) => store.levelUpLabItem);
  const reroll = useGame((store) => store.rerollLabAffix);

  return (
    <li className="lab-slot-card" data-filled={item !== null} data-qa={`lab-slot-${slot}`}>
      <p className="lab-slot-title">
        <b>{SLOT_LABEL[slot]}</b>
        <span>{SLOT_HINT[slot]}</span>
      </p>
      {item ? (
        <ItemBody
          item={item}
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
              Sortear atributo
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
            <span className="lab-item-hint">Custos em ADScoins</span>
          </div>
        </ItemBody>
      ) : (
        <p className="lab-slot-empty">{enabled ? 'Vazio. Os itens vêm da pesquisa.' : 'Indisponível nesta turma.'}</p>
      )}
    </li>
  );
}

/** The Bancada: what the equipped items add to the clicker and the lab, the run buffs, and the four slots. */
export function Bench({ view }: { view: LabBenchView }) {
  const enabled = view.available.ok;
  return (
    <section className="lab-bench" aria-label="Bancada" data-qa="lab-bench">
      <header className="lab-section-head">
        <h3>Bancada</h3>
        <p>
          Poder <b>{formatNumber(view.power)}</b> · Dano <b>{perSecond(view.autoDps)}</b>/s
        </p>
      </header>

      {!enabled ? (
        <p className="lab-note" data-tone="warn">
          Inventário bloqueado: {view.available.reason?.toLowerCase() ?? 'indisponível'}. Suba cada aula ao nível 1 para ligar o monitor.
        </p>
      ) : null}

      <div className="lab-summary">
        <p className="lab-summary-title">No clicker</p>
        {view.clicker.length > 0 ? (
          <LineList lines={view.clicker} />
        ) : (
          <p className="lab-item-note">Os itens equipados reforçam o clicker até a formatura.</p>
        )}
        {view.effects.length > 0 ? (
          <>
            <p className="lab-summary-title">No laboratório</p>
            <LineList lines={view.effects} />
          </>
        ) : null}
        {view.buffs.length > 0 ? (
          <>
            <p className="lab-summary-title">Buffs da pesquisa</p>
            <ul className="lab-buffs">
              {view.buffs.map((buff) => (
                <li key={buff.id} title={buff.description} data-qa={`lab-buff-${buff.id}`}>
                  <span aria-hidden="true">{buff.emoji}</span> {buff.name}
                  {buff.count > 1 ? <b> ×{buff.count}</b> : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      <ul className="lab-slots">
        {view.slots.map(({ slot, item }) => (
          <SlotCard key={slot} slot={slot} item={item} enabled={enabled} />
        ))}
      </ul>
    </section>
  );
}
