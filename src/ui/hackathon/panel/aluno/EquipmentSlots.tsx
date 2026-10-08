import { SLOT_IDS } from '@/hackathon/content/types';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { Icon } from '@/ui/kit';
import { baseById } from '../lib/hk';
import { ItemIcon } from '../lib/ItemIcon';
import { RARITY_NAME, SLOT_LABEL } from '../lib/labels';
import { equippedItems } from '../lib/profileBuild';

interface EquipmentSlotsProps {
  profile: HackathonProfile;
  onOpenItem: (id: string) => void;
  /** An empty slot: the items tab is where something gets equipped. */
  onOpenItems: () => void;
}

/** The four slots with what is equipped. Every slot opens the items tab, on the item when there is one. */
export function EquipmentSlots({ profile, onOpenItem, onOpenItems }: EquipmentSlotsProps) {
  const equipped = equippedItems(profile);
  return (
    <ul className="hk-slots" data-qa="hk-slots">
      {SLOT_IDS.map((slot) => {
        const item = equipped[slot];
        const base = item ? baseById.get(item.base) : undefined;
        if (!item || !base) {
          return (
            <li key={slot}>
              <button
                type="button"
                className="hk-slot"
                data-empty="true"
                data-slot={slot}
                onClick={onOpenItems}
                aria-label={`${SLOT_LABEL[slot]}: vazio. Abrir os itens.`}
              >
                <span className="hk-frame hk-slot-frame" data-empty="true">
                  <Icon name="plus" size={12} />
                </span>
                <span className="hk-slot-text">
                  <small>{SLOT_LABEL[slot]}</small>
                  <span className="hk-slot-name">Vazio</span>
                </span>
              </button>
            </li>
          );
        }
        return (
          <li key={slot}>
            <button
              type="button"
              className="hk-slot"
              data-slot={slot}
              data-rarity={item.rarity}
              onClick={() => onOpenItem(item.id)}
              aria-label={`${SLOT_LABEL[slot]}: ${base.name}, ${RARITY_NAME[item.rarity]}, nível ${item.level}. Abrir nos itens.`}
            >
              <span className="hk-frame hk-slot-frame" data-rarity={item.rarity}>
                <ItemIcon asset={base.asset} scale={2} />
              </span>
              <span className="hk-slot-text">
                <small>{SLOT_LABEL[slot]}</small>
                <span className="hk-slot-name">{base.name}</span>
                <span className="hk-slot-meta">
                  {RARITY_NAME[item.rarity]} · nv {item.level}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
