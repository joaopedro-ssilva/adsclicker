import { Character } from '@/ui/art/Character';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { Badge, Button, ProgressBar } from '@/ui/kit';
import { Card } from '../screen/Card';
import { studentSprite } from '../arena/studentSprite';
import { cargoById } from '../panel/lib/hk';
import { whole } from '../panel/lib/labels';

interface NameplateProps {
  profile: HackathonProfile;
  name: string;
  onDetails: () => void;
}

/** The student's plate: bust, nickname, cargo, level and experience, and the way into the details. */
export function Nameplate({ profile, name, onDetails }: NameplateProps) {
  const cargo = cargoById.get(profile.cargo);
  const atCap = cargo ? profile.level >= cargo.maxLevel : false;
  const xpMax = Math.max(1, profile.xpToNext);

  return (
    <Card className="hk-nameplate" qa="hk-student">
      <div className="hk-bust" aria-hidden="true">
        <Character {...studentSprite(profile.head, profile.cargo, name)} scale={2} shadow={false} label="" />
      </div>
      <div className="hk-nameplate-info">
        <div className="hk-nameplate-title">
          <h2>{name}</h2>
          <Badge tone="accent">{cargo?.name ?? profile.cargo}</Badge>
        </div>
        <ProgressBar
          value={atCap ? 1 : profile.xp}
          max={atCap ? 1 : xpMax}
          label={`Nível ${profile.level}`}
          valueLabel={atCap ? 'máximo do cargo' : `${whole(profile.xp)} / ${whole(xpMax)} XP`}
          segmented
          segments={16}
        />
      </div>
      <Button variant="secondary" size="sm" className="hk-details-button" onClick={onDetails}>
        Detalhes
      </Button>
    </Card>
  );
}
