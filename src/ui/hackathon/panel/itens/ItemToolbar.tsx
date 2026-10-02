import type { SlotId } from '@/hackathon/content';
import { SLOT_IDS } from '@/hackathon/content/types';
import { Button } from '@/ui/kit';
import { SORT_LABEL, type SortKey } from '../lib/itemInfo';
import { SLOT_LABEL } from '../lib/labels';

export type SlotFilter = SlotId | 'todos';

interface ItemToolbarProps {
  sort: SortKey;
  onSort: (key: SortKey) => void;
  slot: SlotFilter;
  onSlot: (slot: SlotFilter) => void;
  counts: Record<SlotFilter, number>;
  selecting: boolean;
  onToggleSelecting: () => void;
  disabled: boolean;
}

const SORTS = Object.keys(SORT_LABEL) as SortKey[];

/** Sort, slot filter and the multi-select switch. */
export function ItemToolbar({ sort, onSort, slot, onSlot, counts, selecting, onToggleSelecting, disabled }: ItemToolbarProps) {
  return (
    <div className="hk-toolbar">
      <div className="hk-chips" role="group" aria-label="Filtrar por espaço">
        {(['todos', ...SLOT_IDS] as SlotFilter[]).map((entry) => (
          <button
            key={entry}
            type="button"
            className="hk-chip"
            aria-pressed={slot === entry}
            data-qa={`hk-filter-${entry}`}
            onClick={() => onSlot(entry)}
          >
            {entry === 'todos' ? 'Todos' : SLOT_LABEL[entry]}
            <small>{counts[entry]}</small>
          </button>
        ))}
      </div>
      <div className="hk-toolbar-row">
        <div className="hk-chips" role="group" aria-label="Ordenar">
          <span className="hk-toolbar-label">Ordem</span>
          {SORTS.map((key) => (
            <button key={key} type="button" className="hk-chip" aria-pressed={sort === key} data-qa={`hk-sort-${key}`} onClick={() => onSort(key)}>
              {SORT_LABEL[key]}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          variant="secondary"
          aria-pressed={selecting}
          disabled={disabled}
          data-qa="hk-select-mode"
          onClick={onToggleSelecting}
        >
          {selecting ? 'Concluir' : 'Selecionar'}
        </Button>
      </div>
    </div>
  );
}
