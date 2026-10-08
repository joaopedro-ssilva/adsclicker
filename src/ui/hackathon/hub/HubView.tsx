'use client';
import { useState } from 'react';
import { useCloud } from '@/game/cloud';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { Card } from '../screen/Card';
import { useHackathonUi } from '../screen/uiStore';
import { CafeCard } from '../panel/aluno/CafeCard';
import { EquipmentSlots } from '../panel/aluno/EquipmentSlots';
import { PromotionGoal } from '../panel/aluno/PromotionGoal';
import { StatGrid } from '../panel/aluno/StatGrid';
import { AdventureCard } from './AdventureCard';
import { DetailsModal } from './DetailsModal';
import { HubStudent } from './HubStudent';
import { Nameplate } from './Nameplate';

/**
 * The Aluno tab: the student stands in the arena and cards float around them. Not a window.
 * DOM order is the phone order; the desktop grid places the cards around the student.
 */
export function HubView({ profile }: { profile: HackathonProfile }) {
  const nickname = useCloud((store) => store.me?.nickname ?? null);
  const openItem = useHackathonUi((store) => store.openItem);
  const setTab = useHackathonUi((store) => store.setTab);
  const [details, setDetails] = useState(false);
  const name = nickname ?? 'Aluno';

  return (
    <>
      <div className="hk-panel hk-hub" data-qa="hk-hub">
        <div className="hk-area-name">
          <Nameplate profile={profile} name={name} onDetails={() => setDetails(true)} />
        </div>
        <div className="hk-area-student">
          <HubStudent profile={profile} name={name} />
        </div>
        <div className="hk-area-cafe">
          <CafeCard profile={profile} />
        </div>
        <div className="hk-area-adventure">
          <AdventureCard profile={profile} />
        </div>
        <div className="hk-area-stats">
          <Card title="Atributos" icon="star">
            <StatGrid profile={profile} />
          </Card>
        </div>
        <div className="hk-area-gear">
          <Card
            title="Equipamento"
            icon="shield"
            aside={
              <button type="button" className="hk-link" onClick={() => setDetails(true)}>
                Bônus de conjunto
              </button>
            }
          >
            <EquipmentSlots profile={profile} onOpenItem={openItem} onOpenItems={() => setTab('itens')} />
          </Card>
        </div>
        <div className="hk-area-goal">
          <PromotionGoal profile={profile} />
        </div>
      </div>
      <DetailsModal profile={profile} open={details} onClose={() => setDetails(false)} />
    </>
  );
}
