'use client';

import { useCallback, useState } from 'react';
import { useHackathon } from '@/ui/hackathon/store';
import { Icon, Tabs } from '@/ui/kit';
import type { IconName, TabItem } from '@/ui/kit';
import { AlunoTab } from './aluno/AlunoTab';
import { StagesTab } from './fases/StagesTab';
import { SkillsTab } from './habilidades/SkillsTab';
import { ItemsTab } from './itens/ItemsTab';
import { MentorsTab } from './mentores/MentorsTab';
import { PanelState } from './PanelState';
import { ResourceBar } from './ResourceBar';

type HackathonTab = 'aluno' | 'itens' | 'habilidades' | 'mentores' | 'fases';

function TabLabel({ icon, children }: { icon: IconName; children: string }) {
  return (
    <span className="panel-tab-label">
      <Icon name={icon} size={24} />
      <span>{children}</span>
    </span>
  );
}

/** The side panel of the Hackathon mode: five tabs around the student. Read-only while a fight runs. */
export function HackathonPanel() {
  const status = useHackathon((store) => store.status);
  const lockReason = useHackathon((store) => store.lockReason);
  const profile = useHackathon((store) => store.profile);
  const running = useHackathon((store) => store.run !== null);
  const [tab, setTab] = useState<HackathonTab>('aluno');
  // The student tab opens an item in the items tab: the id travels through here.
  const [focusItem, setFocusItem] = useState<string | null>(null);

  const openItem = useCallback((id: string) => {
    setFocusItem(id);
    setTab('itens');
  }, []);

  if (status !== 'ready' || !profile) {
    return (
      <aside className="side-panel hk-panel" aria-label="Painel do Hackathon">
        <PanelState status={status} lockReason={lockReason} />
      </aside>
    );
  }

  const items: TabItem[] = [
    {
      value: 'aluno',
      label: <TabLabel icon="crown">Aluno</TabLabel>,
      content: <AlunoTab profile={profile} onOpenItem={openItem} />,
      testId: 'hk-tab-aluno',
    },
    {
      value: 'itens',
      label: <TabLabel icon="shield">Itens</TabLabel>,
      content: <ItemsTab profile={profile} focusItem={focusItem} />,
      testId: 'hk-tab-itens',
    },
    {
      value: 'habilidades',
      label: <TabLabel icon="star">Habilid.</TabLabel>,
      content: <SkillsTab profile={profile} />,
      testId: 'hk-tab-habilidades',
    },
    {
      value: 'mentores',
      label: <TabLabel icon="book">Mentores</TabLabel>,
      content: <MentorsTab profile={profile} />,
      testId: 'hk-tab-mentores',
    },
    {
      value: 'fases',
      label: <TabLabel icon="rocket">Fases</TabLabel>,
      content: <StagesTab profile={profile} />,
      testId: 'hk-tab-fases',
    },
  ];

  return (
    <aside className="side-panel hk-panel" aria-label="Painel do Hackathon">
      <ResourceBar profile={profile} />
      {running ? (
        <div className="hk-readonly" role="status" data-qa="hk-readonly">
          <Icon name="lock" size={12} />
          Luta em andamento: o painel fica só para consulta até ela acabar.
        </div>
      ) : null}
      <Tabs items={items} value={tab} onChange={(value) => {
          setFocusItem(null);
          setTab(value as HackathonTab);
        }} label="Painel do Hackathon" />
    </aside>
  );
}
