import { audio } from '@/ui/audio';
import { Icon } from '@/ui/kit';

interface FavouriteStarProps {
  /** What is starred, for the accessible name: "Maçã Verde". */
  name: string;
  favourite: boolean;
  onToggle: () => void;
}

/** The star on an owned card. Pressed means favourite. */
export function FavouriteStar({ name, favourite, onToggle }: FavouriteStarProps) {
  return (
    <button
      type="button"
      className="album-star"
      aria-pressed={favourite}
      aria-label={favourite ? `Tirar ${name} das favoritas` : `Favoritar ${name}`}
      title={favourite ? 'Tirar das favoritas' : 'Favoritar'}
      data-qa="album-star"
      onClick={() => {
        audio.play('uiTap');
        onToggle();
      }}
    >
      <Icon name="star" size={24} />
    </button>
  );
}
