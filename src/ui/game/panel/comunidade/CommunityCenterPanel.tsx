'use client';
import { donationTitles } from '@/game/content/donations';
import { parseDecimal } from '@/game/engine/decimal';
import { donationProgress } from '@/game/engine/actions';
import { formatNumber } from '@/game/engine/format';
import { useGameState } from '@/game/store/hooks';
import { Icon, Modal, ProgressBar } from '@/ui/kit';
import { DonateControls } from './DonateControls';
import { DonorBadge } from './DonorBadge';
import { DonorsRanking } from './DonorsRanking';
import { useDonors } from './useDonors';

/** The logo of the Centro Comunitário (generated art; scripts/art/queue.mjs). */
export const COMMUNITY_CENTER_LOGO = '/assets/icons/community-center.png';

function Summary() {
  const donated = useGameState((state) => state.donated);
  const donations = useGameState((state) => state.counters.donations);
  const { current, next, missing, progress } = donationProgress(donated);
  return (
    <section className="cc-summary" aria-label="Seu total doado" data-qa="cc-summary">
      {/* eslint-disable-next-line @next/next/no-img-element -- a pixel-art sprite from public/assets, drawn at its own size */}
      <img className="cc-logo cc-logo-big" src={COMMUNITY_CENTER_LOGO} alt="" width={112} height={94} />
      <div className="cc-summary-body">
        <span className="cc-label">Você já doou</span>
        <strong className="cc-total" data-qa="cc-total">
          {formatNumber(donated, { integer: true })}
        </strong>
        <span className="cc-sub">
          ADScoins em {formatNumber(donations, { integer: true })} {donations === 1 ? 'doação' : 'doações'}
        </span>
        <span className="cc-current">
          {current ? <DonorBadge id={current.id} /> : <span className="cc-none">Sem título ainda</span>}
        </span>
      </div>
      <div className="cc-progress">
        {next ? (
          <ProgressBar
            value={progress}
            max={1}
            tone="good"
            segmented
            segments={24}
            label={`Próximo título: ${next.emoji} ${next.name}`}
            valueLabel={`faltam ${formatNumber(missing)}`}
          />
        ) : (
          <p className="cc-maxed">Todos os títulos conquistados. Seu nome está na fachada!</p>
        )}
      </div>
    </section>
  );
}

function Milestones() {
  const donated = useGameState((state) => state.donated);
  const { current } = donationProgress(donated);
  return (
    <section className="cc-section" aria-labelledby="cc-titles-title">
      <h3 id="cc-titles-title">Títulos do Centro</h3>
      <ul className="cc-titles" data-qa="cc-titles">
        {donationTitles.map((title, index) => {
          const unlocked = donated.gte(parseDecimal(title.threshold));
          return (
            <li key={title.id} className="cc-title" data-unlocked={unlocked} data-current={current?.id === title.id || undefined} data-tier={index}>
              <span className="cc-title-emoji" aria-hidden="true">
                {unlocked ? title.emoji : <Icon name="lock" size={16} />}
              </span>
              <span className="cc-title-text">
                <strong>{title.name}</strong>
                <span>{title.description}</span>
              </span>
              <span className="cc-title-need">{unlocked ? 'Conquistado' : `${formatNumber(parseDecimal(title.threshold))}`}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

interface CommunityCenterPanelProps {
  open: boolean;
  onClose: () => void;
}

/** The Centro Comunitário window: your total and title, the donation controls, the donors ranking and the title ladder. */
export function CommunityCenterPanel({ open, onClose }: CommunityCenterPanelProps) {
  const donors = useDonors(open);
  return (
    <Modal open={open} onClose={onClose} title="Centro Comunitário" size="lg">
      <div className="cc-panel" data-qa="community-center">
        <p className="cc-intro">
          Doe ADScoins ao campus: não rende poder nenhum no jogo, só orgulho. Quanto mais você doa, mais alto o título e a posição entre os doadores.
        </p>
        <Summary />
        <section className="cc-section" aria-labelledby="cc-donate-title">
          <h3 id="cc-donate-title">Doar</h3>
          <DonateControls onDonated={donors.reload} />
        </section>
        <DonorsRanking data={donors.data} loading={donors.loading} failed={donors.failed} />
        <Milestones />
      </div>
    </Modal>
  );
}
