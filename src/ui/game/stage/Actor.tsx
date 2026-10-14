'use client';
import { content, useGameState } from '@/game/store';
import { skinById } from '../shared/characterProps';
import { ClickerButton } from './ClickerButton';
import { ComboMeter } from './ComboMeter';
import { FirstNudge } from './FirstNudge';
import { GoldenState } from './maestria/GoldenState';
import { MythicAura } from './MythicAura';
import { SpeechBubble } from './SpeechBubble';

const floatingSceneries = new Set(content.sceneries.filter((scenery) => scenery.floats).map((scenery) => scenery.id));

/**
 * The professor on stage with what lives around them: speech bubble, combo thermometer and the first hint.
 * In photo mode only the professor and the mythic aura remain.
 */
export function Actor({ scale, photo = false }: { scale: number; photo?: boolean }) {
  const mythic = useGameState((state) => skinById(state.equippedSkin[state.activeProfessor] ?? '')?.rarity === 'mythic');
  const floating = useGameState((state) => floatingSceneries.has(state.equippedScenery));
  return (
    <div className="actor" data-floating={floating} data-mythic={mythic}>
      {mythic ? <MythicAura /> : null}
      {photo ? null : <SpeechBubble />}
      <ClickerButton scale={scale} floating={floating} />
      {photo ? null : <ComboMeter />}
      {photo ? null : <GoldenState />}
      {photo ? null : <FirstNudge />}
    </div>
  );
}
