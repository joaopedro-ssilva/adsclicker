'use client';
import { memo, useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { content, useGame, useGameState } from '@/game/store';
import { Character } from '@/ui/art/Character';
import { characterSprite } from '../shared/characterProps';
import { registerAnchor } from '../wiring/stageRefs';

interface ClickerButtonProps {
  /** Integer zoom of the sprite. */
  scale: number;
}

/**
 * The heart of the game: the professor on stage as one big button. Pointer down counts at once (no waiting for
 * the release), Space and Enter count too, and a click by assistive technology aims at the head.
 * Everything beyond the squash (numbers, coins, sound) comes from the click event in the wiring.
 */
export const ClickerButton = memo(function ClickerButton({ scale }: ClickerButtonProps) {
  const professorId = useGameState((state) => state.activeProfessor);
  const skinId = useGameState((state) => state.equippedSkin[state.activeProfessor]);
  const click = useGame((store) => store.click);
  const [bump, setBump] = useState(0);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    registerAnchor('actor', button.current);
    return () => registerAnchor('actor', null);
  }, []);

  const perform = useCallback(
    (x: number, y: number) => {
      click(x, y);
      setBump((value) => value + 1);
    },
    [click],
  );

  const aimAtHead = useCallback(() => {
    const rect = button.current?.getBoundingClientRect();
    return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.28 } : { x: 0, y: 0 };
  }, []);

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    perform(event.clientX, event.clientY);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (event.repeat) return;
    const head = aimAtHead();
    perform(head.x, head.y);
  };

  const professor = content.professors[professorId];
  return (
    <button
      ref={button}
      type="button"
      className="clicker"
      data-qa="clicker"
      aria-label={`Clicar em ${professor.name} para ganhar Edécoins`}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onKeyUp={(event) => {
        if (event.key === ' ') event.preventDefault();
      }}
      onClick={(event) => {
        // Pointer clicks were counted on pointer down. A click with no pointer (detail 0) comes from assistive tech.
        if (event.detail !== 0) return;
        const head = aimAtHead();
        perform(head.x, head.y);
      }}
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
    >
      <Character {...characterSprite(professorId, skinId)} scale={scale} bump={bump} label={professor.name} />
    </button>
  );
});
