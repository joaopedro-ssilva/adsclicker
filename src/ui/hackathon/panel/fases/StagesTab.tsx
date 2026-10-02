import { useState } from 'react';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { Section } from '@/ui/game/panel/lib/Section';
import { CAMPAIGN } from '../lib/hk';
import { DailyCard } from './DailyCard';
import { StageDetail } from './StageDetail';
import { StagePath } from './StagePath';
import { stageState } from './stageAccess';

/** The daily Hackathon on top, then chapter 1 as a path with the selected stage's detail and start controls. */
export function StagesTab({ profile }: { profile: HackathonProfile }) {
  const [auto, setAuto] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  // Default: the furthest stage the player can enter and has not cleared, else the last open one.
  const frontier = CAMPAIGN.find((stage) => stageState(stage, profile) === 'open') ?? CAMPAIGN[CAMPAIGN.length - 1];
  const selected = CAMPAIGN.find((stage) => stage.id === picked) ?? frontier;

  return (
    <>
      <DailyCard profile={profile} auto={auto} onAuto={setAuto} />
      <Section title="Capítulo 1" note={`${CAMPAIGN.filter((stage) => (profile.stages[stage.id]?.clears ?? 0) > 0).length}/${CAMPAIGN.length}`}>
        <StagePath profile={profile} selectedId={selected?.id ?? ''} onSelect={setPicked} />
      </Section>
      {selected ? <StageDetail stage={selected} profile={profile} auto={auto} onAuto={setAuto} /> : null}
    </>
  );
}
