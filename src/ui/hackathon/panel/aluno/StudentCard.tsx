import { Character } from '@/ui/art/Character';
import { useCloud } from '@/game/cloud';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { Badge, ProgressBar } from '@/ui/kit';
import { cargoById, HK } from '../lib/hk';
import { whole } from '../lib/labels';
import { PromotionGoal } from './PromotionGoal';

// Only used if a sprite is missing: the procedural fallback needs outfit colours.
const PALETTE = { primary: '#4a5bd7', secondary: '#22252e', accent: '#e5484d' } as const;

/** The student: bust portrait, nickname, cargo, level and XP, and what the next promotion asks. */
export function StudentCard({ profile }: { profile: HackathonProfile }) {
  const nickname = useCloud((store) => store.me?.nickname ?? null);
  const cargo = cargoById.get(profile.cargo);
  const head = HK.heads.find((entry) => entry.id === profile.head);
  const atCap = cargo ? profile.level >= cargo.maxLevel : false;
  const xpMax = Math.max(1, profile.xpToNext);

  return (
    <section className="hk-card hk-student" data-qa="hk-student">
      <div className="hk-bust" aria-hidden="true">
        <Character
          body={cargo?.body}
          head={head?.asset ?? `hackathon/heads/${profile.head}`}
          palette={PALETTE}
          seed={profile.head}
          scale={2}
          shadow={false}
          label="Seu aluno"
        />
      </div>
      <div className="hk-student-info">
        <div className="hk-student-title">
          <h2>{nickname ?? 'Aluno'}</h2>
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
        <PromotionGoal profile={profile} />
      </div>
    </section>
  );
}
