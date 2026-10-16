'use client';
import { useState } from 'react';
import { LAB_SLOTS } from '@/game/content/labTypes';
import { formatNumber } from '@/game/engine/format';
import { parseDecimal } from '@/game/engine';
import { useCloud } from '@/game/cloud';
import { content } from '@/game/store';
import type { LabBoard, LabBoardRow, LabBuildEntry } from '@/shared/api';
import { Button } from '@/ui/kit';
import { PlayerAvatar } from '../panel/comunidade/PlayerAvatar';
import { PlayerProfile } from '../panel/comunidade/PlayerProfile';
import { TagBadge } from '../panel/comunidade/TagBadge';
import { ItemArt } from './ItemArt';
import { SLOT_LABEL } from './labFormat';
import { useLabBoards } from './useLabBoards';
import type { LabBoardState } from './useLabBoards';

interface BoardInfo {
  id: LabBoard;
  title: string;
  hint: string;
  /** What the value column says. */
  unit: string;
}

const BOARDS: BoardInfo[] = [
  { id: 'phase', title: 'Mais longe', hint: 'A fase mais alta que o monitor já alcançou. Vale para sempre.', unit: 'Fase' },
  { id: 'run', title: 'Maior turma', hint: 'Mais ADScoins feitos em uma única turma. Vale para sempre.', unit: 'ADScoins' },
];

function valueText(board: LabBoard, value: string): string {
  return board === 'phase' ? value : formatNumber(parseDecimal(value));
}

/** The four item icons of a record, one per slot (a dash where the build had none): rarity border, tooltip with the details. */
function BuildIcons({ build }: { build: readonly LabBuildEntry[] }) {
  return (
    <span className="lab-rank-build" role="list" aria-label="Itens equipados no recorde">
      {LAB_SLOTS.map((slot) => {
        const entry = build.find((item) => item.slot === slot);
        const base = entry ? content.lab.bases.find((candidate) => candidate.id === entry.base) : undefined;
        if (!entry || !base) {
          return <span key={slot} className="lab-rank-slot" data-empty="true" role="listitem" title={`${SLOT_LABEL[slot]}: vazio`} aria-label={`${SLOT_LABEL[slot]}: vazio`} />;
        }
        const rarity = content.lab.rarities.find((candidate) => candidate.id === entry.rarity)?.name ?? entry.rarity;
        const label = `${base.name} · ${rarity} · Nv ${entry.level}`;
        return (
          <span key={slot} className="lab-rank-slot" data-rarity={entry.rarity} role="listitem" title={label}>
            <ItemArt asset={base.asset} name={label} size={34} />
          </span>
        );
      })}
    </span>
  );
}

function Row({ board, row, me, onOpen }: { board: LabBoard; row: LabBoardRow; me: boolean; onOpen: (nickname: string) => void }) {
  const medal = row.rank <= 3 ? row.rank : null;
  return (
    <li className="lab-rank-row" data-me={me || undefined} data-medal={medal ?? undefined} data-clickable="true" data-qa="lab-rank-row">
      <span className="lab-rank-pos" aria-label={`Posição ${row.rank}`}>
        {row.rank}
      </span>
      <PlayerAvatar professor={row.professor} skin={row.skin} />
      <span className="lab-rank-name">
        <button
          type="button"
          className="community-open lab-rank-open"
          aria-label={`Ver o perfil de ${row.nickname}`}
          title={row.nickname}
          data-qa="lab-rank-open-profile"
          onClick={() => onOpen(row.nickname)}
        >
          {row.nickname}
        </button>
        <TagBadge tags={row.tags} />
        {me ? <em className="lab-rank-you">você</em> : null}
      </span>
      <span className="lab-rank-value" title={board === 'run' ? row.value : undefined}>
        {valueText(board, row.value)}
      </span>
      <BuildIcons build={row.build} />
    </li>
  );
}

interface PanelProps {
  info: BoardInfo;
  state: LabBoardState;
  mine: string | null;
  onRetry: () => void;
  onOpen: (nickname: string) => void;
}

function Panel({ info, state, mine, onRetry, onOpen }: PanelProps) {
  return (
    <section className="lab-panel lab-rank-panel" aria-label={info.title} data-qa={`lab-board-${info.id}`}>
      <header className="lab-section-head">
        <h3>{info.title}</h3>
        <p>{info.hint}</p>
      </header>
      {state.status === 'loading' ? (
        <div className="lab-rank-state" aria-busy="true" data-qa="lab-board-loading">
          <p>Carregando o ranking...</p>
        </div>
      ) : null}
      {state.status === 'error' ? (
        <div className="lab-rank-state" data-tone="error" role="alert" data-qa="lab-board-error">
          <p>Não deu para carregar o ranking agora. {state.message}</p>
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Tentar de novo
          </Button>
        </div>
      ) : null}
      {state.status === 'ready' ? (
        <>
          {state.data.entries.length === 0 ? (
            <div className="lab-rank-state" data-qa="lab-board-empty">
              <p>Ninguém no ranking ainda. Quebre o monitor para abrir a lista.</p>
            </div>
          ) : (
            <ol className="lab-rank-list">
              {state.data.entries.map((row) => (
                <Row key={`${row.rank}-${row.nickname}`} board={info.id} row={row} me={mine !== null && row.nickname === mine} onOpen={onOpen} />
              ))}
            </ol>
          )}
          {state.data.me && !state.data.entries.some((row) => row.nickname === state.data.me?.nickname) ? (
            <ol className="lab-rank-pinned" aria-label="Sua posição">
              <Row board={info.id} row={state.data.me} me onOpen={onOpen} />
            </ol>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

/** The Ranking tab: "Mais longe" and "Maior turma", side by side on a wide screen and one at a time on a narrow one. */
export function Ranking() {
  const { boards, reload } = useLabBoards();
  const nickname = useCloud((cloud) => cloud.me?.nickname ?? null);
  const [active, setActive] = useState<LabBoard>('phase');
  const [profile, setProfile] = useState<string | null>(null);

  return (
    <div className="lab-rank" data-active={active} data-qa="lab-ranking">
      <div role="tablist" aria-label="Quadros do ranking" className="lab-rank-switch">
        {BOARDS.map((info) => (
          <button key={info.id} type="button" role="tab" aria-selected={active === info.id} onClick={() => setActive(info.id)} data-qa={`lab-board-tab-${info.id}`}>
            {info.title}
          </button>
        ))}
      </div>
      {nickname === null ? (
        <p className="lab-note lab-rank-note">Crie uma conta (apelido e senha) em Conta para aparecer no ranking.</p>
      ) : null}
      <div className="lab-rank-boards">
        {BOARDS.map((info) => (
          <div key={info.id} className="lab-rank-slot-panel" data-board={info.id} data-on={active === info.id}>
            <Panel info={info} state={boards[info.id]} mine={nickname} onRetry={reload} onOpen={setProfile} />
          </div>
        ))}
      </div>
      {/* The same card as the community board. It is a native dialog, so it sits over the lab and owns Esc until it closes. */}
      {profile ? <PlayerProfile nickname={profile} onClose={() => setProfile(null)} /> : null}
    </div>
  );
}
