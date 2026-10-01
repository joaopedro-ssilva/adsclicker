'use client';

import { content, useGame } from '@/game/store';
import { hasFeature } from '@/game/engine/views';
import { Icon, Tabs } from '@/ui/kit';
import type { IconName, TabItem } from '@/ui/kit';
import { useUi } from '../shared/uiStore';
import type { PanelTab } from '../shared/uiStore';
import { AlbumTab } from './album/AlbumTab';
import { CommunityTab } from './comunidade/CommunityTab';
import { SettingsTab } from './config/SettingsTab';
import { GraduationTab } from './formatura/GraduationTab';
import { LessonsTab } from './aulas/LessonsTab';
import { cachedResearchViews } from './lib/researchCache';
import { ResearchTab } from './pesquisas/ResearchTab';

function TabLabel({ icon, children }: { icon: IconName; children: string }) {
  return (
    <span className="panel-tab-label">
      <Icon name={icon} size={24} />
      <span>{children}</span>
    </span>
  );
}

/** The right-hand panel: five tabs (the bottom bar on phones, so the thumb reaches it). */
export function SidePanel() {
  const ready = useGame((store) => store.ready);
  const tab = useUi((ui) => ui.tab);
  const setTab = useUi((ui) => ui.setTab);
  const graduationVisible = useGame(
    (store) => hasFeature(store.state, content, 'graduation') || store.state.diplomasEarned > 0,
  );
  const researchDot = useGame((store) => cachedResearchViews(store.state).some((view) => view.affordable));

  if (!ready) return <aside className="side-panel" aria-label="Painel" />;

  const items: TabItem[] = [
    { value: 'aulas', label: <TabLabel icon="book">Aulas</TabLabel>, content: <LessonsTab />, testId: 'tab-aulas' },
    {
      value: 'pesquisas',
      label: <TabLabel icon="flask">Pesquisas</TabLabel>,
      content: <ResearchTab />,
      dot: researchDot,
      testId: 'tab-pesquisas',
    },
    { value: 'album', label: <TabLabel icon="trophy">Álbum</TabLabel>, content: <AlbumTab />, testId: 'tab-album' },
    ...(graduationVisible
      ? [
          {
            value: 'formatura',
            label: <TabLabel icon="diploma">Formatura</TabLabel>,
            content: <GraduationTab />,
            testId: 'tab-formatura',
          },
        ]
      : []),
    {
      value: 'comunidade',
      label: <TabLabel icon="star">Turma</TabLabel>,
      content: <CommunityTab />,
      testId: 'tab-comunidade',
    },
    { value: 'config', label: <TabLabel icon="settings">Config</TabLabel>, content: <SettingsTab />, testId: 'tab-config' },
  ];

  // The stage can ask for a tab that is not available (yet): fall back to the first one.
  const current: PanelTab = items.some((item) => item.value === tab) ? tab : 'aulas';

  return (
    <aside className="side-panel" aria-label="Painel">
      <Tabs items={items} value={current} onChange={(value) => setTab(value as PanelTab)} label="Painel do jogo" />
    </aside>
  );
}
