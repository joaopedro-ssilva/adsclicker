'use client';
import { audio } from '@/ui/audio';
import { Icon } from '@/ui/kit';
import type { IconName } from '@/ui/kit';
import { useHackathonUi } from './uiStore';
import type { HackathonTab } from './uiStore';

const TABS: { id: HackathonTab; label: string; icon: IconName }[] = [
  { id: 'aluno', label: 'Aluno', icon: 'crown' },
  { id: 'itens', label: 'Itens', icon: 'shield' },
  { id: 'habilidades', label: 'Habilidades', icon: 'star' },
  { id: 'mentores', label: 'Mentores', icon: 'book' },
  { id: 'fases', label: 'Fases', icon: 'rocket' },
];

/** The five screens of the mode. Sits in the top bar on wide screens and at the bottom on phones. */
export function TabNav({ placement }: { placement: 'top' | 'bottom' }) {
  const tab = useHackathonUi((store) => store.tab);
  const setTab = useHackathonUi((store) => store.setTab);
  return (
    <nav className="hx-tabs" data-placement={placement} aria-label="Telas do Hackathon">
      {TABS.map((item) => (
        <button
          key={item.id}
          type="button"
          className="hx-tab"
          aria-current={tab === item.id ? 'page' : undefined}
          data-qa={`hk-tab-${item.id}`}
          onClick={() => {
            audio.play('uiTap');
            setTab(item.id);
          }}
        >
          <Icon name={item.icon} size={24} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
