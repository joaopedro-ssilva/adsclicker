import type { StatId } from '@/hackathon/content';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { Tooltip } from '@/ui/kit';
import { num, STAT_INFO, STAT_ORDER, statValue } from '../lib/labels';

function hintFor(stat: StatId, value: number): string {
  if (stat === 'resiliencia' && value > 0) return `−${num((100 * value) / (100 + value), 0)}% de dano`;
  return STAT_INFO[stat].hint;
}

/** The six stats of the build, each with a plain-language line and a tooltip with the rule. */
export function StatGrid({ profile }: { profile: HackathonProfile }) {
  return (
    <div className="hk-stats" data-qa="hk-stats">
      {STAT_ORDER.map((stat) => {
        const value = profile.build.stats[stat];
        const info = STAT_INFO[stat];
        return (
          <Tooltip key={stat} content={info.tip}>
            <div className="hk-stat" tabIndex={0} data-stat={stat}>
              <span className="hk-stat-label">{info.label}</span>
              <b className="hk-stat-value">{statValue(stat, value)}</b>
              <span className="hk-stat-hint">{hintFor(stat, value)}</span>
            </div>
          </Tooltip>
        );
      })}
    </div>
  );
}
