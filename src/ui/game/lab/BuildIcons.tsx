'use client';
import { LAB_SLOTS } from '@/game/content/labTypes';
import { content } from '@/game/store';
import type { LabBuildEntry } from '@/shared/api';
import { ItemArt } from './ItemArt';
import { SLOT_LABEL } from './labFormat';

/** The four item icons of a record, one per slot (a dash where the build had none): rarity border, tooltip with the details. */
export function BuildIcons({ build }: { build: readonly LabBuildEntry[] }) {
  return (
    <span className="lab-rank-build" role="list" aria-label="Itens equipados no recorde">
      {LAB_SLOTS.map((slot) => {
        const entry = build.find((item) => item.slot === slot);
        const base = entry ? content.lab.bases.find((candidate) => candidate.id === entry.base) : undefined;
        if (!entry || !base) {
          return (
            <span
              key={slot}
              className="lab-rank-slot"
              data-empty="true"
              role="listitem"
              title={`${SLOT_LABEL[slot]}: vazio`}
              aria-label={`${SLOT_LABEL[slot]}: vazio`}
            />
          );
        }
        const rarity = content.lab.rarities.find((candidate) => candidate.id === entry.rarity)?.name ?? entry.rarity;
        const label = `${base.name} · ${rarity} · Nv ${entry.level}`;
        return (
          <span key={slot} className="lab-rank-slot" data-rarity={entry.rarity} role="listitem" title={label}>
            <ItemArt asset={base.asset} name={label} size={34} />
          </span>
        );
      })}
    </span>
  );
}
