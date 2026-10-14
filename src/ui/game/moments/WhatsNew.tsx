'use client';
import { content } from '@/game/content';
import { useGame } from '@/game/store';
import { audio } from '@/ui/audio';
import { Character } from '@/ui/art/Character';
import { Scenery } from '@/ui/art/Scenery';
import { Button, Icon, Modal, RarityBadge } from '@/ui/kit';
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
  const ownedSceneries = useGame((store) => store.state.sceneries);
  const openAlbum = useUi((store) => store.openAlbum);
  const setTab = useUi((store) => store.setTab);

  const toAlbum = () => {
    audio.play('unlock');
    openAlbum('skins');
    onClose();
  };

  const toRanking = () => {
    setTab('comunidade');
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
          recompensas de conquistas. Uma espiadinha (as mais raras você descobre jogando):
        </p>

        <ul className="whats-new-skins">
          {skins.map((skin) => {
            const have = owned[skin.id] === true;
            const secret = !have && (PATCH.secretRarities as readonly string[]).includes(skin.rarity);
            return (
              <li key={skin.id} className="whats-new-skin" data-rarity={skin.rarity}>
                <div className="whats-new-sprite" data-secret={secret}>
                  <Character
                    {...characterSprite(skin.professor, skin.id)}
                    scale={2}
                    idle={!secret}
                    shadow={false}
                    label={secret ? 'Skin secreta' : skin.name}
                  />
                </div>
                <h3>{secret ? '???' : skin.name}</h3>
                <RarityBadge rarity={skin.rarity} />
                <p className="whats-new-hint">{unlockHint('skin', skin.id, have)}</p>
              </li>
            );
          })}
        </ul>

        <h3 className="whats-new-heading">Cenários</h3>
        <ul className="whats-new-sceneries">
          {sceneries.map((scenery) => {
            const secret = ownedSceneries[scenery.id] !== true && (PATCH.secretSceneries as readonly string[]).includes(scenery.id);
            return (
              <li key={scenery.id}>
                {secret ? (
                  <div className="whats-new-scenery whats-new-scenery-secret" aria-label="Cenário secreto">
                    ?
                  </div>
                ) : (
                  <Scenery scenery={scenery} className="whats-new-scenery" focusY={0.45}>
                    <span className="sr-only">{scenery.name}</span>
                  </Scenery>
                )}
                <span>{secret ? '???' : scenery.name}</span>
              </li>
            );
          })}
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

        <div className="whats-new-feature">
          <Icon name="trophy" size={28} />
          <div>
            <h3>Perfil dos jogadores</h3>
            <p className="muted">
              Na aba Turma, clique em alguém do ranking para ver o professor em cena, a skin, o cenário e as estatísticas da
              pessoa.
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={toRanking}>
            Ver ranking
          </Button>
        </div>
      </div>
    </Modal>
  );
}
