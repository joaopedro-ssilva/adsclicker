'use client';
import { ClickerButton } from './ClickerButton';
import { ComboMeter } from './ComboMeter';
import { FirstNudge } from './FirstNudge';
import { SpeechBubble } from './SpeechBubble';

/** The professor on stage with what lives around them: speech bubble, combo thermometer and the first hint. */
export function Actor({ scale }: { scale: number }) {
  return (
    <div className="actor">
      <SpeechBubble />
      <ClickerButton scale={scale} />
      <ComboMeter />
      <FirstNudge />
    </div>
  );
}
