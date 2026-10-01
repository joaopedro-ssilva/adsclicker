'use client';
import { useGame } from '@/game/store';
import type { OfflineReport as OfflineReportData } from '@/game/store';
import { formatDuration } from '@/game/engine/format';
import { audio } from '@/ui/audio';
import { fx } from '@/ui/fx';
import { Button, Icon, Modal } from '@/ui/kit';
import { anchorElement } from '../wiring/stageRefs';
import { CountUp } from './CountUp';

/** Shown on boot when the player was away long enough to have earned something. */
export function OfflineReport({ report }: { report: OfflineReportData }) {
  const dismiss = useGame((store) => store.dismissOffline);
  const capped = report.countedMs < report.awayMs;

  const close = (origin?: HTMLElement) => {
    const balance = anchorElement('balance');
    const rect = origin?.getBoundingClientRect();
    if (balance && rect) {
      fx.coins({ x: rect.left + rect.width / 2, y: rect.top, target: balance, count: 26, color: '#f7ca75' });
      audio.play('buy');
    }
    dismiss();
  };

  return (
    <Modal
      open
      onClose={() => close()}
      title="Bem-vindo de volta!"
      size="sm"
      footer={
        <Button onClick={(event) => close(event.currentTarget)} size="lg">
          Coletar
        </Button>
      }
    >
      <div className="offline">
        <p className="muted">
          Você ficou fora por <b>{formatDuration(report.awayMs)}</b>
          {capped ? `, e a turma trabalhou por ${formatDuration(report.countedMs)}` : ' e a turma não parou'}.
        </p>
        <p className="offline-amount">
          <Icon name="coin" size={36} className="offline-coin" />
          <span>
            +<CountUp value={report.coins} />
          </span>
        </p>
        <p className="muted offline-note">Edécoins renderam enquanto você estava fora.</p>
      </div>
    </Modal>
  );
}
