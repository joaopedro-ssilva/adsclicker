import type { HackathonProfile } from '@/shared/hackathonApi';
import { Commits } from './lib/Commits';

/** Level, Commits and Café, visible in every tab because every tab spends or earns them. */
export function ResourceBar({ profile }: { profile: HackathonProfile }) {
  return (
    <div className="hk-resources" data-qa="hk-resources">
      <span className="hk-res-level">
        Nível <b>{profile.level}</b>
      </span>
      <span title="Commits" data-qa="hk-commits">
        <Commits amount={profile.commits} size={12} />
      </span>
      <span className="hk-res-cafe" data-empty={profile.cafe.count === 0} title="Café" data-qa="hk-cafe-count">
        <span aria-hidden="true">☕</span>
        <b>
          {profile.cafe.count}/{profile.cafe.max}
        </b>
      </span>
    </div>
  );
}
