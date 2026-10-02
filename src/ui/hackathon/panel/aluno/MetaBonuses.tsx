import type { HackathonProfile } from '@/shared/hackathonApi';
import { Tooltip } from '@/ui/kit';
import { META_INFO, META_ORDER, metaValue } from '../lib/labels';

/** The bonuses outside the six stats. Zeros stay on the list, dimmed, so the player knows they exist. */
export function MetaBonuses({ profile }: { profile: HackathonProfile }) {
  return (
    <ul className="hk-metas" data-qa="hk-metas">
      {META_ORDER.map((meta) => {
        const value = profile.build.meta[meta];
        const info = META_INFO[meta];
        return (
          <li key={meta} data-zero={value === 0}>
            <Tooltip content={info.tip}>
              <div className="hk-meta" tabIndex={0}>
                <span className="hk-meta-text">
                  <span>{info.label}</span>
                  <small>{info.hint}</small>
                </span>
                <b>{value === 0 ? '—' : `+${metaValue(value)}`}</b>
              </div>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}
