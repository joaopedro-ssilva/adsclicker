import { useGame, useHasFeature } from '@/game/store';
import { content } from '@/game/content';
import { audio } from '@/ui/audio';
import { Button } from '@/ui/kit';
import { useUi } from '../../shared/uiStore';
import type { AlbumSection } from '../../shared/uiStore';
import { AchievementsSection } from './AchievementsSection';
import { SceneriesSection } from './SceneriesSection';
import { SkinsSection } from './SkinsSection';
import { ThemesSection } from './ThemesSection';

interface SectionItem {
  value: AlbumSection;
  label: string;
}

const SECTIONS: SectionItem[] = [
  { value: 'skins', label: 'Skins' },
  { value: 'cenarios', label: 'Cenários' },
  { value: 'temas', label: 'Temas' },
  { value: 'conquistas', label: 'Conquistas' },
];

/** Collection screen: skins, sceneries, HUD themes and achievements. */
export function AlbumTab() {
  const hudThemes = useHasFeature('hudThemes');
  const stored = useUi((ui) => ui.albumSection);
  const openAlbum = useUi((ui) => ui.openAlbum);
  const section: AlbumSection = stored === 'temas' && !hudThemes ? 'skins' : stored;

  const owned = useGame((store) => store.state.skins);
  const ownedSkins = content.skins.filter((skin) => owned[skin.id]).length;

  const items = SECTIONS.filter((item) => item.value !== 'temas' || hudThemes);

  return (
    <div className="album">
      <div className="album-switch" role="group" aria-label="Seção do álbum">
        {items.map((item) => (
          <Button
            key={item.value}
            size="sm"
            variant="secondary"
            aria-pressed={section === item.value}
            data-qa={`album-${item.value}`}
            onClick={() => {
              audio.play('uiTap');
              openAlbum(item.value);
            }}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {section === 'skins' ? (
        <p className="panel-hint album-count">
          {ownedSkins}/{content.skins.length} skins na coleção. Desbloqueie as outras com conquistas.
        </p>
      ) : null}

      {section === 'skins' ? <SkinsSection /> : null}
      {section === 'cenarios' ? <SceneriesSection /> : null}
      {section === 'temas' ? <ThemesSection /> : null}
      {section === 'conquistas' ? <AchievementsSection /> : null}
    </div>
  );
}
