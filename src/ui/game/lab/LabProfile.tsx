'use client';
import { useEffect, useState } from 'react';
import { content } from '@/game/store';
import { formatNumber } from '@/game/engine/format';
import { parseDecimal } from '@/game/engine';
import type { LabProfile as Profile } from '@/shared/api';
import { api } from '@/shared/apiClient';
import { Button, EmptyState, Modal } from '@/ui/kit';
import { PlayerAvatar } from '../panel/comunidade/PlayerAvatar';
import { TagBadge } from '../panel/comunidade/TagBadge';
import { ItemArt } from './ItemArt';
import { LabStage, StaticMonitor } from './LabStage';
import { BuildIcons } from './BuildIcons';

const whole = (value: number) => formatNumber(value, { integer: true });

type State = {
  nickname: string;
  profile: Profile | null;
  error: string | null;
};

interface LabProfileProps {
  nickname: string;
  onClose: () => void;
  /** Opens the classroom card of the same player (the old click of the Ranking). */
  onOpenClass: (nickname: string) => void;
}

/**
 * A ranked player's lab, opened by a click on the lab Ranking: their monitor with the skin, the theme and the decoration they
 * wear (an idle screen with their best phase, no fight), their lab numbers and the builds of their two records. The card of the
 * classroom is one link away.
 */
export function LabProfile({ nickname, onClose, onOpenClass }: LabProfileProps) {
  const [state, setState] = useState<State>({
    nickname,
    profile: null,
    error: null,
  });
  const current = state.nickname === nickname ? state : { nickname, profile: null, error: null };

  useEffect(() => {
    const controller = new AbortController();
    void api.labProfile(nickname, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setState(
        result.ok
          ? { nickname, profile: result.data, error: null }
          : {
              nickname,
              profile: null,
              error: result.status === 404 ? 'Esse laboratório ainda não está disponível para visita.' : result.error.message,
            },
      );
    });
    return () => controller.abort();
  }, [nickname]);

  return (
    <Modal open onClose={onClose} title={`Laboratório de ${nickname}`} size="lg">
      {current.profile ? (
        <LabProfileBody profile={current.profile} onOpenClass={onOpenClass} />
      ) : current.error ? (
        <EmptyState title="Laboratório indisponível" icon="trophy">
          {current.error}
          <p>
            <Button size="sm" variant="secondary" onClick={() => onOpenClass(nickname)} data-qa="lab-profile-class">
              Ver perfil na Turma
            </Button>
          </p>
        </EmptyState>
      ) : (
        <div className="profile-loading" aria-busy="true" data-qa="lab-profile-loading">
          Carregando o laboratório…
        </div>
      )}
    </Modal>
  );
}

function LabProfileBody({ profile, onOpenClass }: { profile: Profile; onOpenClass: (nickname: string) => void }) {
  const { stats } = profile;
  const start = content.lab.cosmetics.items.find((entry) => entry.id === profile.startItem);
  const skin = content.lab.cosmetics.items.find((entry) => entry.id === profile.monitor);
  const theme = content.lab.cosmetics.items.find((entry) => entry.id === profile.theme);
  const coins = parseDecimal(profile.bestRunCoins);
  const rows: [string, string][] = [
    ['Fase mais alta', whole(profile.bestPhase)],
    ['Commits ganhos', whole(stats.commitsEarned)],
    ['Pesquisas iniciadas', whole(stats.runs)],
    ['Monitores quebrados', whole(stats.broken)],
    ['Fases vencidas', whole(stats.phasesCleared)],
    ['Chefões derrotados', whole(stats.bossesBeaten)],
    ['Itens encontrados', whole(stats.itemsFound)],
    ['Itens reciclados', whole(stats.itemsRecycled)],
    ['Níveis comprados', whole(stats.itemLevelUps)],
    ['Atributos sorteados', whole(stats.affixRerolls)],
    ['Cliques no monitor', whole(stats.clicks)],
    ['Cosméticos', `${whole(stats.cosmeticsOwned)}/${whole(content.lab.cosmetics.items.length)}`],
    ['Maior turma (ADScoins)', coins.gt(0) ? formatNumber(coins) : '-'],
  ];

  return (
    <div className="lab-profile" data-qa="lab-profile">
      <header className="lab-profile-head">
        <PlayerAvatar professor={profile.professor} skin={profile.skin} />
        <div className="lab-profile-who">
          <p className="lab-profile-name">
            {profile.nickname} <TagBadge tags={profile.tags} />
          </p>
          <p className="lab-profile-sub">
            {skin?.name ?? 'CRT'} · tema {theme?.name ?? 'Fósforo Verde'}
            {start ? ` · item inicial: ${start.name}` : ''}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => onOpenClass(profile.nickname)} data-qa="lab-profile-class">
          Ver perfil na Turma
        </Button>
      </header>

      <div className="lab-profile-stage" data-lab-theme={profile.theme} data-qa="lab-profile-stage">
        <LabStage decor={profile.decor}>
          <StaticMonitor skin={profile.monitor}>
            <div className="lab-center lab-profile-screen">
              <p className="lab-kicker">Fase mais alta</p>
              <p className="lab-profile-phase" data-qa="lab-profile-phase">
                {profile.bestPhase > 0 ? profile.bestPhase : '-'}
              </p>
              {start?.art ? (
                <div className="lab-profile-start">
                  <ItemArt asset={start.art} name={start.name} size={48} />
                  <span>{start.name}</span>
                </div>
              ) : null}
              <p className="lab-center-fine">
                {stats.bossesBeaten > 0 ? `${whole(stats.bossesBeaten)} chefões derrotados` : 'Nenhum chefão derrotado ainda'}
              </p>
            </div>
          </StaticMonitor>
        </LabStage>
      </div>

      <dl className="lab-profile-stats">
        {rows.map(([label, value]) => (
          <div key={label} className="lab-profile-stat">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="lab-profile-builds">
        <div>
          <p className="lab-profile-build-title">Recorde de fase</p>
          <BuildIcons build={profile.phaseBuild} />
        </div>
        <div>
          <p className="lab-profile-build-title">Maior turma</p>
          <BuildIcons build={profile.runBuild} />
        </div>
      </div>
    </div>
  );
}
