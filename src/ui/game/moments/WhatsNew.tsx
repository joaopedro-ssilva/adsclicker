'use client';
import { useState } from 'react';
import { content } from '@/game/content';
import { useGame } from '@/game/store';
import { audio } from '@/ui/audio';
import { Character } from '@/ui/art/Character';
import { Scenery } from '@/ui/art/Scenery';
import { Button, Collapsible, Icon, Modal, RarityBadge } from '@/ui/kit';
import { unlockHint } from '../panel/album/albumData';
import { characterSprite } from '../shared/characterProps';
import { useUi } from '../shared/uiStore';
import { PATCHES } from './patchNotes';
import type { Patch } from './patchNotes';

const pick = <T extends { id: string }>(items: T[], ids: readonly string[] = []): T[] =>
  ids.flatMap((id) => items.filter((item) => item.id === id));

const dateFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });
const formatDate = (iso: string) => dateFormat.format(new Date(`${iso}T00:00:00Z`));

interface PatchBodyProps {
  patch: Patch;
  onRanking: () => void;
}

/** What one patch brought: skins on their professors, sceneries, themes, the notes and the optional ranking card. */
function PatchBody({ patch, onRanking }: PatchBodyProps) {
  const owned = useGame((store) => store.state.skins);
  const ownedSceneries = useGame((store) => store.state.sceneries);
  const skins = pick(content.skins, patch.skins);
  const sceneries = pick(content.sceneries, patch.sceneries);
  const themes = pick(content.themes, patch.themes);

  return (
    <div className="whats-new">
      {skins.length > 0 ? (
        <>
          <h3 className="whats-new-heading">Skins</h3>
          <ul className="whats-new-skins">
            {skins.map((skin) => {
              const have = owned[skin.id] === true;
              const secret = !have && (patch.secretRarities ?? []).includes(skin.rarity);
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
        </>
      ) : null}

      {sceneries.length > 0 ? (
        <>
          <h3 className="whats-new-heading">Cenários</h3>
          <ul className="whats-new-sceneries">
            {sceneries.map((scenery) => {
              const secret = ownedSceneries[scenery.id] !== true && (patch.secretSceneries ?? []).includes(scenery.id);
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
        </>
      ) : null}

      {themes.length > 0 ? (
        <>
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
        </>
      ) : null}

      {patch.notes.length > 0 ? (
        <ul className="whats-new-notes">
          {patch.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}

      {patch.ranking ? (
        <div className="whats-new-feature">
          <Icon name="trophy" size={28} />
          <div>
            <h3>{patch.ranking.title}</h3>
            <p className="muted">{patch.ranking.text}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={onRanking}>
            Ver ranking
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** The Jornal do Campus: every patch of the game as a section that folds. The newest one starts open. */
export function WhatsNew({ onClose }: { onClose: () => void }) {
  const openAlbum = useUi((store) => store.openAlbum);
  const setTab = useUi((store) => store.setTab);
  const [open, setOpen] = useState<Record<string, boolean>>(() => ({ [PATCHES[0]!.id]: true }));

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
      title="Jornal do Campus"
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
      <div className="journal">
        {PATCHES.map((patch, index) => (
          <Collapsible
            key={patch.id}
            title={patch.title}
            summary={`${formatDate(patch.date)}. ${patch.summary}`}
            attention={index === 0 && open[patch.id] !== true}
            attentionLabel="novidade"
            open={open[patch.id] === true}
            onOpenChange={(next) => setOpen((current) => ({ ...current, [patch.id]: next }))}
            testId={`journal-${patch.id}`}
          >
            <PatchBody patch={patch} onRanking={toRanking} />
          </Collapsible>
        ))}
      </div>
    </Modal>
  );
}
