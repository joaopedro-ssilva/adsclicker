import type { HackathonProfile } from '@/shared/hackathonApi';
import { CAMPAIGN } from '../lib/hk';
import { StageNode } from './StageNode';
import { stageLock, stageState } from './stageAccess';

interface StagePathProps {
  profile: HackathonProfile;
  selectedId: string;
  onSelect: (id: string) => void;
}

/** The chapter as a path, top to bottom: each stop joined to the next by a rail that lights up as you clear them. */
export function StagePath({ profile, selectedId, onSelect }: StagePathProps) {
  return (
    <ol className="hk-path" data-qa="hk-path">
      {CAMPAIGN.map((stage) => (
        <StageNode
          key={stage.id}
          stage={stage}
          state={stageState(stage, profile)}
          clears={profile.stages[stage.id]?.clears ?? 0}
          lock={stageLock(stage, profile)}
          selected={stage.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </ol>
  );
}
