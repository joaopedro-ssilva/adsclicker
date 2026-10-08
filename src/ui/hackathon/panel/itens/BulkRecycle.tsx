import { useState } from 'react';
import { recycleValue } from '@/hackathon/engine';
import type { ItemInstance } from '@/hackathon/engine';
import { useHackathon } from '@/ui/hackathon/store';
import { Button } from '@/ui/kit';
import { Commits } from '../lib/Commits';
import { ConfirmDialog } from '../lib/ConfirmDialog';
import { HK } from '../lib/hk';
import { needsConfirmation } from '../lib/itemInfo';
import { useBusy } from '../lib/useBusy';
import { InlineError, useAction } from '../lib/useAction';

interface BulkRecycleProps {
  /** Marked in multi-select mode (equipped ones already left out). */
  marked: ItemInstance[];
  /** Every common that is not equipped. */
  commons: ItemInstance[];
  selecting: boolean;
  onDone: () => void;
}

const total = (items: ItemInstance[]): number => items.reduce((sum, item) => sum + recycleValue(item, HK), 0);

/** Recycling many items at once: every common, or the ones marked by hand. Always asks first. */
export function BulkRecycle({ marked, commons, selecting, onDone }: BulkRecycleProps) {
  const { locked } = useBusy();
  const { run: report, error } = useAction();
  const [batch, setBatch] = useState<ItemInstance[] | null>(null);

  const confirm = async () => {
    if (!batch) return;
    const ids = batch.map((item) => item.id);
    setBatch(null);
    const ok = await report(useHackathon.getState().recycle(ids), {
      title: `${ids.length} ${ids.length === 1 ? 'item reciclado' : 'itens reciclados'}`,
      description: `+${total(batch)} Commits`,
      tone: 'good',
    });
    if (ok) onDone();
  };

  const rare = batch?.filter((item) => needsConfirmation(item.rarity)).length ?? 0;

  return (
    <>
      <div className="hk-bulk">
        {selecting ? (
          <Button
            size="sm"
            variant={marked.length > 0 ? 'danger' : 'secondary'}
            disabled={locked || marked.length === 0}
            data-qa="hk-recycle-selected"
            onClick={() => setBatch(marked)}
          >
            Reciclar {marked.length} {marked.length === 1 ? 'selecionado' : 'selecionados'}
            {marked.length > 0 ? <Commits amount={total(marked)} /> : null}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            disabled={locked || commons.length === 0}
            data-qa="hk-recycle-commons"
            onClick={() => setBatch(commons)}
          >
            Reciclar comuns ({commons.length})
            {commons.length > 0 ? <Commits amount={total(commons)} /> : null}
          </Button>
        )}
      </div>
      <InlineError message={error} />
      <ConfirmDialog
        open={batch !== null}
        title="Reciclar itens"
        confirmLabel={`Reciclar ${batch?.length ?? 0}`}
        danger
        disabled={locked}
        confirmQa="hk-recycle-all-confirm"
        onConfirm={() => void confirm()}
        onCancel={() => setBatch(null)}
      >
        <p>
          {batch?.length ?? 0} {batch?.length === 1 ? 'item será destruído' : 'itens serão destruídos'} em troca de{' '}
          <strong>{batch ? total(batch) : 0} Commits</strong>. Não dá para desfazer.
        </p>
        {rare > 0 ? <p className="hk-reason">Atenção: {rare} deles são raros ou melhores.</p> : null}
      </ConfirmDialog>
    </>
  );
}
