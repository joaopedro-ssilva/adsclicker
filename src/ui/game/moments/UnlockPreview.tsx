import { Character } from '@/ui/art/Character';
import { Scenery } from '@/ui/art/Scenery';
import { characterSprite } from '../shared/characterProps';
import type { UnlockSubject } from './unlockInfo';

/** What was unlocked, drawn: the skin on its professor, the scenery as a thumbnail, the theme as colour swatches. */
export function UnlockPreview({ subject, scale }: { subject: UnlockSubject; scale: number }) {
  if (subject.item === 'skin') {
    const { def } = subject;
    return <Character {...characterSprite(def.professor, def.id)} scale={scale} label={def.name} idle={scale > 1} />;
  }
  if (subject.item === 'scenery') {
    return (
      <Scenery scenery={subject.def} className="unlock-scenery" focusY={0.7}>
        <span className="sr-only">{subject.def.name}</span>
      </Scenery>
    );
  }
  const { colors } = subject.def;
  return (
    <div className="unlock-theme" aria-hidden="true">
      {[colors.bg, colors.surface, colors.surfaceRaised, colors.border, colors.text, colors.textMuted].map((color) => (
        <i key={color} style={{ background: color }} />
      ))}
    </div>
  );
}
