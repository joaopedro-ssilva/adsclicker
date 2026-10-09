'use client';
import { content, useGameState } from '@/game/store';
import { skinById } from '../shared/characterProps';
import { ClickerButton } from './ClickerButton';
import { ComboMeter } from './ComboMeter';
import { FirstNudge } from './FirstNudge';
import { GoldenMeter } from './maestria/GoldenMeter';
import { MythicAura } from './MythicAura';
import { SpeechBubble } from './SpeechBubble';

const floatingSceneries = new Set(content.sceneries.filter((scenery) => scenery.floats).map((scenery) => scenery.id));

/** The professor on stage with what lives around them: speech bubble, combo thermometer and the first hint. */
export function Actor({ scale }: { scale: number }) {
  const mythic = useGameState((state) => skinById(state.equippedSkin[state.activeProfessor] ?? '')?.rarity === 'mythic');
  const floating = useGameState((state) => floatingSceneries.has(state.equippedScenery));
  return (
    <div className="actor" data-floating={floating} data-mythic={mythic}>
      {mythic ? <MythicAura /> : null}
      <SpeechBubble />
      <ClickerButton scale={scale} floating={floating} />
      <ComboMeter />
      <GoldenMeter />
      <FirstNudge />
    </div>
  );
}
