'use client';
import { useCallback, useEffect, useRef } from 'react';
import { ratio } from '@/game/engine/decimal';
import { formatNumber } from '@/game/engine/format';
import { useGame, useGameState, useProfessorViews } from '@/game/store';
import type { ProfessorId } from '@/game/content/types';
import { audio } from '@/ui/audio';
import { RosterSlot } from './RosterSlot';

/** One portrait per professor along the bottom of the stage: hired (click to put on stage), the next to hire, then locked ones. */
export function Roster() {
  const views = useProfessorViews();
  const coins = useGameState((state) => state.coins);
  const setActive = useGame((store) => store.setActiveProfessor);
  const hire = useGame((store) => store.hireProfessor);

  const select = useCallback(
    (id: ProfessorId) => {
      audio.play('uiTap');
      setActive(id);
    },
    [setActive],
  );
  const hireOne = useCallback((id: ProfessorId) => void hire(id), [hire]);

  const nextId = views.find((view) => !view.hired)?.id;
  const nav = useRef<HTMLElement>(null);

  // On narrow stages the row scrolls: keep the professor you can hire next in view.
  useEffect(() => {
    const row = nav.current;
    const next = row?.querySelector<HTMLElement>('[data-state="next"]');
    if (!row || !next) return;
    const overflow = next.offsetLeft + next.offsetWidth + 8 - row.clientWidth;
    if (overflow > 0) row.scrollTo({ left: overflow, behavior: 'smooth' });
  }, [nextId]);

  return (
    <nav className="roster" aria-label="Professores" ref={nav}>
      {views.map((view) => {
        const state = view.hired ? (view.active ? 'active' : 'hired') : view.id === nextId ? 'next' : 'locked';
        return (
          <RosterSlot
            key={view.id}
            id={view.id}
            name={view.name}
            color={view.color}
            state={state}
            cost={state === 'next' ? formatNumber(view.hireCost, { integer: true }) : ''}
            progress={state === 'next' ? Math.floor(ratio(coins, view.hireCost) * 100) : 0}
            affordable={view.affordable}
            lockReason={state === 'next' && !view.canBeHired ? view.lockReason : null}
            onSelect={select}
            onHire={hireOne}
          />
        );
      })}
    </nav>
  );
}
