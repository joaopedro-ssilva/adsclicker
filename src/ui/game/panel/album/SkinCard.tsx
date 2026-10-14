import { memo } from 'react';
import type { SkinDef } from '@/game/content/types';
import { audio } from '@/ui/audio';
import { Character } from '@/ui/art/Character';
import { Button, Icon, RarityBadge } from '@/ui/kit';
import { characterSprite } from '../../shared/characterProps';
import { unlockHint } from './albumData';
import { mythicFrameVariables } from '../../stage/mythicEffects';
import { FavouriteStar } from './FavouriteStar';

interface SkinCardProps {
  skin: SkinDef;
  owned: boolean;
  equipped: boolean;
  favourite: boolean;
  onEquip: (id: string) => void;
  onFavourite: (id: string) => void;
}

/** A skin: owned ones can be equipped and starred, locked ones are a dark silhouette. Both say how the skin is got. */
export const SkinCard = memo(function SkinCard({ skin, owned, equipped, favourite, onEquip, onFavourite }: SkinCardProps) {
  const hint = unlockHint('skin', skin.id, owned);
  return (
    <article className="skin-card" data-rarity={skin.rarity} data-owned={owned} data-equipped={equipped} style={mythicFrameVariables(skin.id)}>
      <div className="skin-card-stage">
        <div className="skin-card-sprite" data-locked={!owned}>
          <Character
            {...characterSprite(skin.professor, skin.id)}
            scale={2}
            idle={false}
            shadow={false}
            label={owned ? skin.name : 'Skin bloqueada'}
          />
        </div>
        {!owned ? <Icon name="lock" size={24} className="skin-card-lock" /> : null}
        {owned ? <FavouriteStar name={skin.name} favourite={favourite} onToggle={() => onFavourite(skin.id)} /> : null}
      </div>
      <h3 className="skin-card-name">{owned ? skin.name : '???'}</h3>
      <RarityBadge rarity={skin.rarity} />
      {hint ? <p className="skin-card-hint">{hint}</p> : null}
      {owned ? (
        <Button
          size="sm"
          variant={equipped ? 'secondary' : 'primary'}
          aria-pressed={equipped}
          data-qa={`skin-${skin.id}`}
          onClick={() => {
            if (equipped) return;
            audio.play('uiTap');
            onEquip(skin.id);
          }}
        >
          {equipped ? (
            <>
              <Icon name="check" size={12} />
              Equipada
            </>
          ) : (
            'Equipar'
          )}
        </Button>
      ) : null}
    </article>
  );
});
