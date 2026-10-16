'use client';
import { useState } from 'react';
import { donationProgress } from '@/game/engine/actions';
import { formatNumber } from '@/game/engine/format';
import { useGameState } from '@/game/store/hooks';
import { Icon } from '@/ui/kit';
import { COMMUNITY_CENTER_LOGO, CommunityCenterPanel } from './CommunityCenterPanel';
import { DonorBadge } from './DonorBadge';

/**
 * The prominent button of the Turma tab that opens the Centro Comunitário. It reads only the donated total,
 * so it re-renders when a donation is made and not on every tick.
 */
export function CommunityCenterButton() {
  const [open, setOpen] = useState(false);
  const donated = useGameState((state) => state.donated);
  const { current, next } = donationProgress(donated);
  return (
    <>
      <button type="button" className="cc-button pixel-frame" data-qa="community-center-open" onClick={() => setOpen(true)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a pixel-art sprite from public/assets, drawn at its own size */}
        <img className="cc-logo" src={COMMUNITY_CENTER_LOGO} alt="" width={64} height={54} />
        <span className="cc-button-text">
          <strong>Centro Comunitário</strong>
          <span>
            {donated.gt(0)
              ? `Você doou ${formatNumber(donated, { integer: true })} ADScoins.`
              : 'Doe ADScoins ao campus, suba no ranking e ganhe títulos.'}
          </span>
          <span className="cc-button-title">
            {current ? <DonorBadge id={current.id} /> : null}
            {next ? <span className="cc-button-next">{current ? 'Próximo: ' : 'Primeiro título: '}{next.emoji} {next.name}</span> : null}
          </span>
        </span>
        <Icon name="arrowUp" size={24} className="cc-button-go" />
      </button>
      <CommunityCenterPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}
