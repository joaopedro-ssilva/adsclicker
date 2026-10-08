import type { ItemInstance } from '@/hackathon/engine';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { Modal } from '@/ui/kit';
import { itemName } from '../lib/itemInfo';
import { ItemDetail } from './ItemDetail';

interface ItemDetailModalProps {
  profile: HackathonProfile;
  /** The item to show, or null with the modal closed. */
  item: ItemInstance | null;
  onClose: () => void;
}

/** The item detail as a modal, for screens too narrow for the side pane. */
export function ItemDetailModal({ profile, item, onClose }: ItemDetailModalProps) {
  return (
    <Modal open={item !== null} onClose={onClose} title={item ? itemName(item) : 'Item'}>
      {item ? <ItemDetail profile={profile} item={item} showName={false} onGone={onClose} /> : null}
    </Modal>
  );
}
