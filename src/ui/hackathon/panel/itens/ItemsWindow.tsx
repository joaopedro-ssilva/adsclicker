'use client';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { Window } from '../../screen/Window';
import { useHackathonUi } from '../../screen/uiStore';
import { ItemsTab } from './ItemsTab';

/** The items screen. */
export function ItemsWindow({ profile }: { profile: HackathonProfile }) {
  const focusItem = useHackathonUi((store) => store.focusItem);
  return (
    <Window title="Itens" icon="shield" size="md" qa="hk-window-itens">
      <div className="hk-panel">
        <ItemsTab profile={profile} focusItem={focusItem} />
      </div>
    </Window>
  );
}
