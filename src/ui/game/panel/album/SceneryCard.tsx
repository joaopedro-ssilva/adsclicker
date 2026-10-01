import { memo } from 'react';
import type { SceneryDef } from '@/game/content/types';
import { audio } from '@/ui/audio';
import { Scenery } from '@/ui/art/Scenery';
import { Button, Icon } from '@/ui/kit';
import { unlockHint } from './albumData';

interface SceneryCardProps {
  scenery: SceneryDef;
  owned: boolean;
  equipped: boolean;
  onEquip: (id: string) => void;
}

/** A scenery with a live thumbnail (no particles, to keep fourteen of them cheap). */
export const SceneryCard = memo(function SceneryCard({ scenery, owned, equipped, onEquip }: SceneryCardProps) {
  return (
    <article className="album-scenery-card" data-owned={owned} data-equipped={equipped}>
      <div className="album-scenery-card-thumb" data-locked={!owned}>
        <Scenery scenery={scenery} ambient="none" focusY={0.7} className="album-scenery-card-art" />
        {!owned ? <Icon name="lock" size={24} className="album-scenery-card-lock" /> : null}
      </div>
      <h3>{owned ? scenery.name : '???'}</h3>
      {owned ? (
        <>
          <p className="album-scenery-card-desc">{scenery.description}</p>
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
      ) : (
        <p className="skin-card-hint">{unlockHint('scenery', scenery.id)}</p>
      )}
    </article>
  );
});
