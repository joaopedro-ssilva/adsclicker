'use client';
import { parseDecimal, ratio } from '@/game/engine/decimal';
import { formatDuration, formatNumber, formatPercent } from '@/game/engine/format';
import type { LastRun, RecordKey, Records } from '@/game/engine/state';
import { content } from '@/game/store';
import { fmtInt } from '../panel/lib/numbers';

const SOURCES = [
  ['classes', 'Aulas'],
  ['clicks', 'Cliques'],
  ['autoClicks', 'Cliques automáticos'],
  ['events', 'Invasões'],
  ['sprints', 'Sprints'],
  ['offline', 'Tempo fora'],
  ['other', 'Maestrias'],
] as const;

const RECORDS: readonly { key: RecordKey; label: string; show: (records: Records) => string }[] = [
  { key: 'fastestSeconds', label: 'Turma mais rápida', show: (records) => formatDuration(records.fastestSeconds * 1000) },
  { key: 'mostClicks', label: 'Mais cliques numa turma', show: (records) => fmtInt(records.mostClicks) },
  { key: 'biggestCombo', label: 'Maior combo', show: (records) => `×${fmtInt(records.biggestCombo)}` },
  { key: 'mostCoins', label: 'Mais ADScoins numa turma', show: (records) => formatNumber(records.mostCoins) },
];

interface GraduationSummaryProps {
  run: LastRun;
  records: Records;
}

/** The turma that just ended, in numbers: what the run did and where its coins came from. Nothing here is estimated. */
export function GraduationSummary({ run, records }: GraduationSummaryProps) {
  const summary = run.summary;
  if (!summary) return null;

  const total = parseDecimal(summary.coins.total);
  const rows = SOURCES.map(([key, label]) => {
    const amount = parseDecimal(summary.coins[key]);
    return { key, label, amount, share: total.gt(0) ? Math.min(1, ratio(amount, total)) : 0 };
  }).filter((row) => row.amount.gt(0));
  const honoured = summary.honoured ? content.professors[summary.honoured] : null;
  const marked = RECORDS.filter((record) => summary.recordsBeaten.includes(record.key) || summary.recordsStarted.includes(record.key));

  return (
    <div className="gradsum" data-qa="graduation-summary">
      <p className="scene-kicker">Resumo da turma</p>

      <dl className="gradsum-facts">
        <div>
          <dt>Duração</dt>
          <dd>{formatDuration(run.seconds * 1000)}</dd>
        </div>
        <div>
          <dt>Cliques</dt>
          <dd>{fmtInt(run.clicks)}</dd>
        </div>
        <div>
          <dt>Diplomas</dt>
          <dd>
            +{fmtInt(summary.diplomas)}
            {summary.bonus > 0 ? <small> ({fmtInt(summary.bonus)} das Horas)</small> : null}
          </dd>
        </div>
        <div>
          <dt>Maior combo</dt>
          <dd>×{fmtInt(summary.maxCombo)}</dd>
        </div>
        <div>
          <dt>Invasões</dt>
          <dd>
            {fmtInt(run.eventsDefended)} defendidas
            <small>, {fmtInt(run.eventsMissed)} perdidas</small>
          </dd>
        </div>
        <div>
          <dt>Sprints</dt>
          <dd>
            {fmtInt(run.sprintsCompleted)} entregues
            <small>, {fmtInt(run.sprintsFailed)} falhos</small>
          </dd>
        </div>
        <div className="gradsum-wide">
          <dt>Professor homenageado</dt>
          <dd>{honoured ? honoured.name : 'Ninguém desta vez'}</dd>
        </div>
      </dl>

      {summary.capped ? (
        <p className="gradsum-cap" data-qa="graduation-capped">
          Teto de diplomas atingido: as ADScoins além dele não renderam mais diplomas.
        </p>
      ) : null}

      <section className="gradsum-block" aria-label="De onde vieram as ADScoins">
        <h3>
          ADScoins da turma <b>{formatNumber(total)}</b>
        </h3>
        <ul className="gradsum-sources">
          {rows.map((row) => (
            <li key={row.key}>
              <span>{row.label}</span>
              <b>{formatNumber(row.amount)}</b>
              <em>{formatPercent(row.share, row.share > 0 && row.share < 0.1 ? 1 : 0)}</em>
              <i style={{ width: `${Math.max(2, row.share * 100)}%` }} aria-hidden="true" />
            </li>
          ))}
        </ul>
      </section>

      {marked.length > 0 ? (
        <section className="gradsum-block" aria-label="Recordes pessoais">
          <h3>Recordes pessoais</h3>
          <ul className="gradsum-records">
            {marked.map((record) => (
              <li key={record.key} data-beaten={summary.recordsBeaten.includes(record.key)}>
                <span>{record.label}</span>
                <b>{record.show(records)}</b>
                <em>{summary.recordsBeaten.includes(record.key) ? 'Novo recorde' : 'Marca registrada'}</em>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
