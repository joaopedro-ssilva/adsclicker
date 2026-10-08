import type { ItemInstance } from '@/hackathon/engine';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { ItemDetail } from './ItemDetail';

interface ItemPaneProps {
  profile: HackathonProfile;
  item: ItemInstance | null;
  selecting: boolean;
  onGone: () => void;
}

/** The detail pane beside the grid: the open item, or what to do to open one. */
export function ItemPane({ profile, item, selecting, onGone }: ItemPaneProps) {
  return (
    <aside className="hk-pane" aria-label="Detalhe do item" data-qa="hk-pane">
      {item ? (
        <ItemDetail key={item.id} profile={profile} item={item} showName onGone={onGone} />
      ) : (
        <p className="hk-pane-empty">
          {selecting ? 'Marque os itens que quer reciclar e use o botão abaixo da grade.' : 'Selecione um item da grade para ver os atributos, comparar e equipar.'}
        </p>
      )}
    </aside>
  );
}
