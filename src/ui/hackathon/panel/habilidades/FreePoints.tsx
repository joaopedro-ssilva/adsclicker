import type { HackathonProfile } from '@/shared/hackathonApi';

/** Unspent skill points, for the window header. */
export function FreePoints({ profile }: { profile: HackathonProfile }) {
  const free = profile.freeSkillPoints;
  const total = profile.level - 1;
  return (
    <div className="hk-points" data-qa="hk-points" data-has={free > 0}>
      <span className="hk-points-number">{free}</span>
      <span className="hk-points-text">
        <strong>{free === 1 ? 'ponto livre' : 'pontos livres'}</strong>
        <small>
          {total - free} de {total} gastos · 1 ponto por nível
        </small>
      </span>
    </div>
  );
}
