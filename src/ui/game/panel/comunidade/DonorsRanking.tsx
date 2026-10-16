'use client';
import { useState } from 'react';
import { useCloud } from '@/game/cloud';
import { formatNumber } from '@/game/engine/format';
import type { DonorRow, DonorsResponse } from '@/shared/api';
import { Button, EmptyState } from '@/ui/kit';
import { DonorBadge } from './DonorBadge';
import { GuestNotice } from './GuestNotice';
import { PlayerAvatar } from './PlayerAvatar';
import { TagBadge } from './TagBadge';

/** Rows shown before "ver mais". */
const PAGE = 10;

function Row({ entry, own, pinned }: { entry: DonorRow; own: boolean; pinned?: boolean }) {
  const podium = entry.rank <= 3 ? entry.rank : 0;
  return (
    <li
      className="community-row cc-row"
      data-podium={podium || undefined}
      data-own={own || undefined}
      data-pinned={pinned || undefined}
      data-qa={pinned ? 'cc-own-row' : 'cc-row'}
    >
      <span className="community-rank">{entry.rank}º</span>
      <PlayerAvatar professor={entry.professor} skin={entry.skin} />
      <span className="community-name">
        <span className="community-nick" title={entry.nickname}>
          {entry.nickname}
          <TagBadge tags={entry.tags} />
          {own ? <span className="community-you">você</span> : null}
        </span>
        <span className="community-sub">
          <DonorBadge id={entry.title} />
          {entry.title ? null : <span>Sem título ainda</span>}
        </span>
      </span>
      <span className="community-value">{formatNumber(entry.value, { integer: true })}</span>
    </li>
  );
}

interface DonorsRankingProps {
  data: DonorsResponse | null;
  loading: boolean;
  failed: boolean;
}

/** The donors board: the top 50 with the caller's own row pinned under it when it is not among the rows shown. */
export function DonorsRanking({ data, loading, failed }: DonorsRankingProps) {
  const me = useCloud((cloud) => cloud.me);
  const [count, setCount] = useState(PAGE);
  const entries = data?.entries ?? [];
  const own = data?.me ?? null;
  const ownNick = own?.nickname.toLowerCase() ?? null;
  const isOwn = (entry: DonorRow) => ownNick !== null && entry.nickname.toLowerCase() === ownNick;
  const visible = entries.slice(0, count);
  const ownShown = ownNick !== null && visible.some(isOwn);

  return (
    <section className="cc-section" aria-labelledby="cc-ranking-title">
      <h3 id="cc-ranking-title">Maiores doadores</h3>
      {!me?.nickname ? <GuestNotice /> : null}
      {loading ? (
        <ul className="community-list" aria-busy="true" aria-label="Carregando doadores">
          {Array.from({ length: 4 }, (_, index) => (
            <li key={index} className="community-row community-skeleton" />
          ))}
        </ul>
      ) : failed && entries.length === 0 ? (
        <EmptyState title="Ranking indisponível" icon="trophy">
          Não consegui falar com o servidor agora. Sua doação continua valendo.
        </EmptyState>
      ) : entries.length === 0 ? (
        <EmptyState title="Ninguém doou ainda" icon="trophy">
          Seja o primeiro a ajudar o campus e abra o ranking.
        </EmptyState>
      ) : (
        <>
          <ul className="community-list" data-qa="cc-list">
            {visible.map((entry) => (
              <Row key={entry.rank} entry={entry} own={isOwn(entry)} />
            ))}
          </ul>
          {entries.length > count ? (
            <Button variant="ghost" size="sm" className="community-more" data-qa="cc-more" onClick={() => setCount(count + PAGE * 2)}>
              Ver mais ({entries.length - count})
            </Button>
          ) : null}
        </>
      )}
      {own && !ownShown ? (
        <ul className="community-list cc-pinned" aria-label="Sua posição">
          <Row entry={own} own pinned />
        </ul>
      ) : null}
      {me?.nickname && !own && !loading ? (
        <p className="community-note">Doe qualquer quantia para entrar no ranking. O total aparece aqui em até um minuto.</p>
      ) : null}
    </section>
  );
}
