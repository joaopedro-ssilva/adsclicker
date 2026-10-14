'use client';
import { content, useGameState } from '@/game/store';
import { skinById } from '../shared/characterProps';
import { ClickerButton } from './ClickerButton';
import { ComboMeter } from './ComboMeter';
import { FirstNudge } from './FirstNudge';
import { GoldenState } from './maestria/GoldenState';
import { MythicAura } from './MythicAura';
import { mythicEffectOf } from './mythicEffects';
import { SpeechBubble } from './SpeechBubble';

const floatingSceneries = new Set(content.sceneries.filter((scenery) => scenery.floats).map((scenery) => scenery.id));

/**
 * The professor on stage with what lives around them: speech bubble, combo thermometer and the first hint.
 * In photo mode only the professor and the mythic aura remain.
 */
export function Actor({ scale, photo = false }: { scale: number; photo?: boolean }) {
  // The id of the equipped skin when it has an effect of its own (the mythic ones, see mythicEffects.ts).
  const mythic = useGameState((state) => {
    const id = state.equippedSkin[state.activeProfessor] ?? '';
    return skinById(id)?.rarity === 'mythic' && mythicEffectOf(id) ? id : null;
  });
  const floating = useGameState((state) => floatingSceneries.has(state.equippedScenery));
  return (
    <div className="actor" data-floating={floating} data-mythic={mythic !== null}>
      {mythic ? <MythicAura skinId={mythic} scale={scale} /> : null}
      {photo ? null : <SpeechBubble />}
      <ClickerButton scale={scale} floating={floating} />
      {photo ? null : <ComboMeter />}
      {photo ? null : <GoldenState />}
      {photo ? null : <FirstNudge />}
    </div>
  );
}
