import { Character } from '@/ui/art/Character';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { studentSprite } from '../arena/studentSprite';
import { useFitScale } from '../arena/useFitScale';
import { cargoById } from '../panel/lib/hk';

/** The student standing on the floor of the arena, as large as the free space in the middle allows. */
export function HubStudent({ profile, name }: { profile: HackathonProfile; name: string }) {
  const { ref, scale } = useFitScale(0, 4);
  return (
    <div className="hk-hub-student" ref={ref}>
      <Character
        {...studentSprite(profile.head, profile.cargo, name)}
        scale={scale}
        label={`${name}, ${cargoById.get(profile.cargo)?.name ?? ''}`}
      />
    </div>
  );
}
