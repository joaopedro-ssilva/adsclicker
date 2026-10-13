'use client';
import { content } from '@/game/content';
import { useGame } from '@/game/store';
import { audio } from '@/ui/audio';
import { Character } from '@/ui/art/Character';
import { Scenery } from '@/ui/art/Scenery';
import { Button, Modal, RarityBadge } from '@/ui/kit';
import { unlockHint } from '../panel/album/albumData';
import { characterSprite } from '../shared/characterProps';
import { useUi } from '../shared/uiStore';
import { PATCH } from './whatsNew';

const pick = <T extends { id: string }>(items: T[], ids: readonly string[]): T[] =>
  ids.flatMap((id) => items.filter((item) => item.id === id));

const skins = pick(content.skins, PATCH.skins);
const sceneries = pick(content.sceneries, PATCH.sceneries);
const themes = pick(content.themes, PATCH.themes);

/** The patch announcement: a sneak peek of the new skins on their professors, plus the new sceneries and themes. */
export function WhatsNew({ onClose }: { onClose: () => void }) {
  const owned = useGame((store) => store.state.skins);
  const openAlbum = useUi((store) => store.openAlbum);

  const toAlbum = () => {
    audio.play('unlock');
    openAlbum('skins');
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Novidades na sala!"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={toAlbum}>
            Ver no Álbum
          </Button>
          <Button onClick={onClose}>Bora clicar!</Button>
        </>
      }
    >
      <div className="whats-new">
        <p className="muted">
          Chegaram <b>{skins.length} skins</b>, <b>{sceneries.length} cenários</b> e <b>{themes.length} temas</b>, todos
          recompensas de conquistas. Uma espiadinha:
        </p>

        <ul className="whats-new-skins">
          {skins.map((skin) => (
            <li key={skin.id} className="whats-new-skin" data-rarity={skin.rarity}>
              <div className="whats-new-sprite">
                <Character {...characterSprite(skin.professor, skin.id)} scale={2} idle shadow={false} label={skin.name} />
              </div>
              <h3>{skin.name}</h3>
              <RarityBadge rarity={skin.rarity} />
              <p className="whats-new-hint">{unlockHint('skin', skin.id, owned[skin.id] === true)}</p>
            </li>
          ))}
        </ul>

        <h3 className="whats-new-heading">Cenários</h3>
        <ul className="whats-new-sceneries">
          {sceneries.map((scenery) => (
            <li key={scenery.id}>
              <Scenery scenery={scenery} className="whats-new-scenery" focusY={0.45}>
                <span className="sr-only">{scenery.name}</span>
              </Scenery>
              <span>{scenery.name}</span>
            </li>
          ))}
        </ul>

        <h3 className="whats-new-heading">Temas</h3>
        <ul className="whats-new-themes">
          {themes.map((theme) => (
            <li key={theme.id}>
              <span className="whats-new-swatch" aria-hidden="true">
                {[theme.colors.bg, theme.colors.surfaceRaised, theme.colors.border, theme.colors.text].map((color) => (
                  <i key={color} style={{ background: color }} />
                ))}
              </span>
              <span>{theme.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
