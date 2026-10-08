import type { HackathonProfile } from '@/shared/hackathonApi';
import { CAMPAIGN } from '../lib/hk';
import { StageNode } from './StageNode';
import { stageLockShort, stageState } from './stageAccess';

interface StagePathProps {
  profile: HackathonProfile;
  selectedId: string;
  onSelect: (id: string) => void;
}

/** The chapter as a serpentine path of three rows: each stop is joined to the next by a rail that lights up as you clear them. */
export function StagePath({ profile, selectedId, onSelect }: StagePathProps) {
  return (
    <ol className="hk-path" data-qa="hk-path" aria-label="Fases do capítulo 1">
      {CAMPAIGN.map((stage) => (
        <StageNode
          key={stage.id}
          stage={stage}
          state={stageState(stage, profile)}
          clears={profile.stages[stage.id]?.clears ?? 0}
          lock={stageLockShort(stage, profile)}
          selected={stage.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </ol>
  );
}
