import { memo } from 'react';
import type { SceneryDef } from '@/game/content/types';
import { audio } from '@/ui/audio';
import { Scenery } from '@/ui/art/Scenery';
import { Button, Icon } from '@/ui/kit';
import { unlockHint } from './albumData';
import { FavouriteStar } from './FavouriteStar';

interface SceneryCardProps {
  scenery: SceneryDef;
  owned: boolean;
  equipped: boolean;
  favourite: boolean;
  onEquip: (id: string) => void;
  onFavourite: (id: string) => void;
}

/** A scenery with a live thumbnail (no particles, to keep fourteen of them cheap). */
export const SceneryCard = memo(function SceneryCard({ scenery, owned, equipped, favourite, onEquip, onFavourite }: SceneryCardProps) {
  const hint = unlockHint('scenery', scenery.id, owned);
  return (
    <article className="album-scenery-card" data-owned={owned} data-equipped={equipped}>
      <div className="album-scenery-card-thumb" data-locked={!owned}>
        <Scenery scenery={scenery} ambient="none" focusY={0.7} className="album-scenery-card-art" />
        {!owned ? <Icon name="lock" size={24} className="album-scenery-card-lock" /> : null}
        {owned ? <FavouriteStar name={scenery.name} favourite={favourite} onToggle={() => onFavourite(scenery.id)} /> : null}
      </div>
      <h3>{owned ? scenery.name : '???'}</h3>
      {owned ? (
        <>
          <p className="album-scenery-card-desc">{scenery.description}</p>
          {hint ? <p className="skin-card-hint">{hint}</p> : null}
          <Button
            size="sm"
            variant={equipped ? 'secondary' : 'primary'}
            aria-pressed={equipped}
            data-qa={`scenery-${scenery.id}`}
            onClick={() => {
              if (equipped) return;
              audio.play('uiTap');
              onEquip(scenery.id);
            }}
          >
            {equipped ? (
              <>
                <Icon name="check" size={12} />
                Em uso
              </>
            ) : (
              'Usar cenário'
            )}
          </Button>
        </>
      ) : hint ? (
        <p className="skin-card-hint">{hint}</p>
      ) : null}
    </article>
  );
});
