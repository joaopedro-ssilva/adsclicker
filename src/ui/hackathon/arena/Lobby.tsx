'use client';
import { Character } from '@/ui/art/Character';
import { ProgressBar } from '@/ui/kit';
import { useMediaQuery } from '@/ui/useMediaQuery';
import { useFitScale } from './useFitScale';
import { useHackathon } from '../store';
import { cargoById } from '../shared/lookup';
import { wholeNumber } from '../shared/format';
import { CafeCounter } from './CafeCounter';
import { studentSprite } from './studentSprite';
import { useCloud } from '@/game/cloud';

/** No fight running: the student in the arena, with the Café and a nudge to pick a stage in the panel. */
export function Lobby() {
  const profile = useHackathon((store) => store.profile);
  const nickname = useCloud((store) => store.me?.nickname ?? null);
  const { ref, scale } = useFitScale(70);
  const wide = useMediaQuery('(min-width: 1024px)');
  if (!profile) return null;
  const cargo = cargoById.get(profile.cargo);
  const name = nickname ?? 'Aluno';

  return (
    <div className="ar-lobby" ref={ref}>
      <div className="ar-lobby-student">
        <Character {...studentSprite(profile.head, profile.cargo, name)} scale={scale} label={`${name}, ${cargo?.name ?? ''}`} />
        <div className="ar-nameplate-box">
          <p className="ar-nameplate">{name}</p>
          <p className="ar-nameplate-sub">
            {cargo?.name} · nível {profile.level}
          </p>
          <ProgressBar
            ariaLabel="Experiência"
            value={profile.xpToNext > 0 ? profile.xp : 1}
            max={profile.xpToNext > 0 ? profile.xpToNext : 1}
            valueLabel={profile.xpToNext > 0 ? `${wholeNumber(profile.xp)}/${wholeNumber(profile.xpToNext)} XP` : 'Nível máximo do cargo'}
            segmented
            segments={16}
            size="sm"
          />
        </div>
      </div>
      <div className="ar-lobby-side">
        <CafeCounter />
        <p className="ar-hint">{wide ? 'Escolha uma fase no painel ao lado.' : 'Escolha uma fase no painel abaixo.'}</p>
      </div>
    </div>
  );
}
