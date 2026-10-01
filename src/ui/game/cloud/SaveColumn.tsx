import type { ReactNode } from 'react';
import type { SaveSummary } from '@/shared/api';
import { parseDecimal } from '@/game/engine/decimal';
import { formatDuration, formatNumber } from '@/game/engine/format';
import { Badge } from '@/ui/kit';

interface SaveColumnProps {
  title: string;
  summary: SaveSummary;
  /** When it was saved, already formatted ("agora", "hoje às 21:40"). */
  savedAt: string;
  recommended: boolean;
  action: ReactNode;
  note: string;
  testId: string;
}

/** One side of the conflict dialog: the numbers of a save and the button that keeps it. */
export function SaveColumn({ title, summary, savedAt, recommended, action, note, testId }: SaveColumnProps) {
  const rows: [string, string][] = [
    ['ADScoins totais', formatNumber(parseDecimal(summary.lifetimeCoins), { integer: true })],
    ['Diplomas', String(summary.diplomasEarned)],
    ['Professores', String(summary.professors)],
    ['Conquistas', String(summary.achievements)],
    ['Tempo de jogo', formatDuration(summary.playSeconds * 1000)],
    ['Salvo', savedAt],
  ];

  return (
    <section className="conflict-column" data-recommended={recommended} data-qa={testId}>
      <header className="conflict-column-head">
        <h3>{title}</h3>
        {recommended ? <Badge tone="good">Mais progresso</Badge> : null}
      </header>
      <dl className="conflict-rows">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {action}
      <p className="conflict-note">{note}</p>
    </section>
  );
}
