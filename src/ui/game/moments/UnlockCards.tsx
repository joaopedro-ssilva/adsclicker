'use client';
import { useEffect } from 'react';
import { Button, IconButton, RarityBadge } from '@/ui/kit';
import { equipUnlock } from './equipUnlock';
import { useMoments, type UnlockMoment } from './momentsStore';
import { KIND_LABEL, unlockCaption, unlockSubject } from './unlockInfo';
import { UnlockPreview } from './UnlockPreview';

const CARD_MS = 10_000;

function UnlockCard({ moment }: { moment: UnlockMoment }) {
  const dismiss = useMoments((store) => store.dismissCard);
  const subject = unlockSubject(moment);

  useEffect(() => {
    const timer = setTimeout(() => dismiss(moment.id), CARD_MS);
    return () => clearTimeout(timer);
  }, [dismiss, moment.id]);

  if (!subject) return null;
  return (
    <article className="unlock-card pixel-frame" data-rarity={moment.rarity} data-item={subject.item}>
      <div className="unlock-card-art">
        <UnlockPreview subject={subject} scale={1} />
      </div>
      <div className="unlock-card-body">
        <p className="eyebrow">{KIND_LABEL[subject.item]}</p>
        <p className="unlock-card-name">
          {subject.def.name} <RarityBadge rarity={moment.rarity} />
        </p>
        <p className="unlock-card-caption">{unlockCaption(subject)}</p>
        <Button
          size="sm"
          onClick={() => {
            equipUnlock(subject);
            dismiss(moment.id);
          }}
        >
          Equipar agora
        </Button>
      </div>
      <IconButton icon="x" label="Dispensar" size="sm" variant="ghost" onClick={() => dismiss(moment.id)} />
    </article>
  );
}

/** Common and rare unlocks: a quick card in the corner, never in the way of play. */
export function UnlockCards() {
  const cards = useMoments((store) => store.cards);
  if (cards.length === 0) return null;
  return (
    <div className="unlock-cards" role="region" aria-label="Novidades da coleção" aria-live="polite">
      {cards.map((card) => (
        <UnlockCard key={card.id} moment={card} />
      ))}
    </div>
  );
}
