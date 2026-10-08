'use client';
import { useState } from 'react';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { Window } from '../../screen/Window';
import { CAMPAIGN } from '../lib/hk';
import { DailyCard } from './DailyCard';
import { StageDetail } from './StageDetail';
import { StagePath } from './StagePath';
import { clearedCount, frontierStage } from './stageAccess';

/** Chapter 1 as a serpentine path with the selected stage's detail, and the daily Hackathon beside it. */
export function StagesWindow({ profile }: { profile: HackathonProfile }) {
  const [picked, setPicked] = useState<string | null>(null);
  const selected = CAMPAIGN.find((stage) => stage.id === picked) ?? frontierStage(profile);

  return (
    <Window
      title="Capítulo 1"
      icon="rocket"
      size="xl"
      qa="hk-window-fases"
      aside={
        <span className="hk-chapter-count">
          <b>{clearedCount(profile)}</b>/{CAMPAIGN.length} concluídas
        </span>
      }
    >
      <div className="hk-panel hk-stages">
        <StagePath profile={profile} selectedId={selected.id} onSelect={setPicked} />
        <DailyCard profile={profile} />
        <StageDetail stage={selected} profile={profile} />
      </div>
    </Window>
  );
}
