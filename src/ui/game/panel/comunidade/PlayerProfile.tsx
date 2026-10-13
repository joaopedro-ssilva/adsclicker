'use client';
import { useEffect, useState } from 'react';
import { content } from '@/game/content';
import { formatDuration, formatNumber } from '@/game/engine/format';
import { api } from '@/shared/apiClient';
import type { PlayerProfile as Profile } from '@/shared/api';
import { Character } from '@/ui/art/Character';
import { Scenery } from '@/ui/art/Scenery';
import { EmptyState, Icon, Modal } from '@/ui/kit';
import type { IconName } from '@/ui/kit';
import { characterSprite } from '../../shared/characterProps';
import { TagBadge } from './TagBadge';

const whole = (value: number) => formatNumber(value, { integer: true });
const of = (have: number, total: number) => `${whole(have)}/${whole(total)}`;
const defaultScenery = content.sceneries.find((scenery) => scenery.default) ?? content.sceneries[0]!;
const sceneryOf = (id: string) => content.sceneries.find((scenery) => scenery.id === id) ?? defaultScenery;
const skinName = (id: string) => content.skins.find((skin) => skin.id === id)?.name;

type State = { nickname: string; profile: Profile | null; error: string | null };

/** A ranked player's card, opened from the ranking: what they have on screen and their main numbers. */
export function PlayerProfile({ nickname, onClose }: { nickname: string; onClose: () => void }) {
  const [state, setState] = useState<State>({ nickname, profile: null, error: null });
  const current = state.nickname === nickname ? state : { nickname, profile: null, error: null };

  useEffect(() => {
    const controller = new AbortController();
    void api.profile(nickname, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setState(
        result.ok
          ? { nickname, profile: result.data, error: null }
          : { nickname, profile: null, error: result.status === 404 ? 'Esse jogador não está mais no ranking.' : result.error.message },
      );
    });
    return () => controller.abort();
  }, [nickname]);

  return (
    <Modal open onClose={onClose} title={nickname} size="md">
      {current.profile ? (
        <ProfileBody profile={current.profile} />
      ) : current.error ? (
        <EmptyState title="Perfil indisponível" icon="trophy">
          {current.error}
        </EmptyState>
      ) : (
        <div className="profile-loading" aria-busy="true">
          Carregando perfil…
        </div>
      )}
    </Modal>
  );
}

function ProfileBody({ profile }: { profile: Profile }) {
  const { stats } = profile;
  const scenery = sceneryOf(profile.scenery);
  const professor = content.professors[profile.professor];
  const rows: [IconName, string, string][] = [
    ['coin', 'ADScoins no total', formatNumber(stats.lifetimeCoins)],
    ['coin', 'Por segundo', formatNumber(stats.coinsPerSecond)],
    ['click', 'Por clique', formatNumber(stats.clickValue)],
    ['diploma', 'Turmas formadas', whole(stats.graduations)],
    ['diploma', 'Diplomas ganhos', whole(stats.diplomasEarned)],
    ['book', 'Professores', of(stats.professorsHired, Object.keys(content.professors).length)],
    ['crown', 'Maestrias', of(stats.maestrias, Object.keys(content.professors).length)],
    ['trophy', 'Conquistas', of(stats.achievements, content.achievements.length)],
    ['shirt', 'Skins', of(stats.skins, content.skins.length)],
    ['image', 'Cenários', of(stats.sceneries, content.sceneries.length)],
    ['click', 'Cliques', formatNumber(stats.clicks)],
    ['click', 'Combo máximo', whole(stats.maxCombo)],
    ['shield', 'Invasões seguidas', whole(stats.bestEventStreak)],
    ['rocket', 'Sprints concluídos', whole(stats.sprintsCompleted)],
  ];
  return (
    <div className="profile" data-qa="player-profile">
      <Scenery scenery={scenery} focusY={0.65} className="profile-stage">
        <div className="profile-actor">
          <Character {...characterSprite(profile.professor, profile.skin)} scale={2} idle label={`${professor.name} no perfil de ${profile.nickname}`} />
        </div>
      </Scenery>
      <div className="profile-head">
        <TagBadge tags={profile.tags} all />
        <p className="profile-line">
          {profile.online ? <span className="community-dot" data-on="true" role="img" aria-label="online" /> : null}
          {profile.online ? 'Jogando agora' : 'Offline'} · {formatDuration(stats.playSeconds * 1000)} de jogo · na turma desde{' '}
          {new Date(profile.memberSince).toLocaleDateString('pt-BR')}
        </p>
        <p className="profile-line">
          Em cena: <b>{professor.name}</b>
          {skinName(profile.skin) ? (
            <>
              {' '}
              com a skin <b>{skinName(profile.skin)}</b>
            </>
          ) : null}{' '}
          · Cenário: <b>{scenery.name}</b>
        </p>
      </div>
      <dl className="profile-stats">
        {rows.map(([icon, label, value]) => (
          <div key={label} className="profile-stat">
            <dt>
              <Icon name={icon} size={14} />
              {label}
            </dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
