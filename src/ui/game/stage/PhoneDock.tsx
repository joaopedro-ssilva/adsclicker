'use client';
import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { abilityViews, bolsaView, festaView, hasFeature, joinhaView, releasesView, rollforwardView, swarmView } from '@/game/engine/views';
import { content, useBolsaView, useFestaView, useGame, useGameState, useHasFeature, useReleasesView, useRollforwardView, useSwarmView } from '@/game/store';
import { Abilities } from './Abilities';
import { BuffChips } from './BuffChips';
import { ComboMeter } from './ComboMeter';
import { GoldenState } from './maestria/GoldenState';
import { MaestriaDock } from './maestria/MaestriaDock';
import { ReleaseTag } from './maestria/ReleaseTag';
import { Roster } from './Roster';
import { SprintCard } from './SprintCard';

/** Minutes and seconds, short enough for a chip. */
function clock(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

type Tray = 'info' | 'maestrias' | null;

/** Which rows of the phone dock have something to show: the stage reserves room for them so the professor never sits under one. */
export function usePhoneDockRows(): { tools: boolean; status: boolean } {
  // Booleans only, so the stage does not re-render with the views that tick.
  return useGame(
    useShallow((store) => {
      const { state } = store;
      const tools =
        abilityViews(state, content).some((view) => view.unlocked) ||
        hasFeature(state, content, 'sprints') ||
        state.buffs.length > 0 ||
        releasesView(state, content) !== null ||
        rollforwardView(state, content) !== null ||
        swarmView(state, content) !== null ||
        festaView(state, content) !== null ||
        bolsaView(state, content) !== null;
      const status = hasFeature(state, content, 'combo') || joinhaView(state, content) !== null;
      return { tools, status };
    }),
  );
}

/** One small chip for the sprint, the release version and the buffs; it opens them as a tray over the stage. */
function InfoChip({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const sprints = useHasFeature('sprints');
  const release = useReleasesView();
  const active = useGameState((state) => state.sprint.active);
  const now = useGameState((state) => state.lastTickAt);
  const offers = useGameState((state) => state.sprint.offers.length > 0);
  const buffs = useGameState((state) => state.buffs.length);
  if (!sprints && !release && buffs === 0) return null;

  const label = active ? clock(active.endsAt - now) : release ? `v${release.versions}.0` : 'Sprints';
  return (
    <button
      type="button"
      className="info-chip"
      data-qa="info-chip"
      data-alert={!active && offers}
      aria-expanded={open}
      aria-label={`Sprint, versão e efeitos ativos: ${label}`}
      onClick={onToggle}
    >
      <span aria-hidden="true">{active ? '🏃' : '📋'}</span>
      <b>{label}</b>
      {buffs > 0 ? <small aria-hidden="true">✨{buffs}</small> : null}
    </button>
  );
}

function MaestriasButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const roll = useRollforwardView();
  const swarm = useSwarmView();
  const festa = useFestaView();
  const bolsa = useBolsaView();
  if (!roll && !swarm && !festa && !bolsa) return null;
  const ready = Boolean(roll?.ready || swarm?.ready || festa?.ready);
  return (
    <button
      type="button"
      className="maestrias-button"
      data-qa="maestrias-button"
      data-ready={ready}
      aria-expanded={open}
      aria-label={ready ? 'Maestrias, alguma está pronta' : 'Maestrias'}
      onClick={onToggle}
    >
      <span aria-hidden="true">🎓</span>
      <b>Maestrias</b>
    </button>
  );
}

/**
 * The bottom of a phone stage, under the professor and over nothing: the combo and the golden mode as a thin bar,
 * one row of tools (the info chip, the abilities, the Maestrias button) and the one professor row.
 */
export function PhoneDock() {
  const rows = usePhoneDockRows();
  const [tray, setTray] = useState<Tray>(null);

  useEffect(() => {
    if (!tray) return;
    const close = (event: Event) => {
      if (event.type === 'keydown' && (event as KeyboardEvent).key !== 'Escape') return;
      if (event.type === 'pointerdown' && (event.target as Element | null)?.closest?.('.phone-tools')) return;
      setTray(null);
    };
    window.addEventListener('keydown', close);
    window.addEventListener('pointerdown', close);
    return () => {
      window.removeEventListener('keydown', close);
      window.removeEventListener('pointerdown', close);
    };
  }, [tray]);

  const toggle = (which: Exclude<Tray, null>) => setTray((current) => (current === which ? null : which));

  return (
    <div className="phone-dock">
      {rows.status ? (
        <div className="phone-status">
          <ComboMeter />
          <GoldenState />
        </div>
      ) : null}
      {rows.tools ? (
        <div className="phone-tools" role="group" aria-label="Habilidades e ferramentas">
          <InfoChip open={tray === 'info'} onToggle={() => toggle('info')} />
          <Abilities />
          <MaestriasButton open={tray === 'maestrias'} onToggle={() => toggle('maestrias')} />
          {tray === 'info' ? (
            <div className="phone-tray phone-tray-info">
              <SprintCard defaultOpen />
              <ReleaseTag />
              <BuffChips />
            </div>
          ) : null}
          {tray === 'maestrias' ? (
            // One tap on a button closes the tray.
            <div className="phone-tray phone-tray-maestrias" onClick={() => setTray(null)}>
              <MaestriaDock tray />
            </div>
          ) : null}
        </div>
      ) : null}
      <Roster />
    </div>
  );
}
