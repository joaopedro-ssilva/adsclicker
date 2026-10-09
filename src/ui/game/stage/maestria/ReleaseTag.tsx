'use client';
import { formatNumber } from '@/game/engine/format';
import { useReleasesView } from '@/game/store';
import { Tooltip } from '@/ui/kit';

/** B1's Releases: the version of the run, small, under the sprint card. */
export function ReleaseTag() {
  const view = useReleasesView();
  if (!view) return null;
  const next = view.maxed ? 'versão máxima' : `${view.sprints}/${view.perVersion} sprints para a próxima`;
  return (
    <Tooltip
      content={`Releases: a cada ${view.perVersion} sprints concluídas sai uma versão, +${formatNumber(view.bonusPerVersion * 100)}% de produção cada, até ${view.maxVersions}. Zera na formatura.`}
    >
      <p className="release-tag" data-qa="release-tag">
        <span aria-hidden="true">🏷️</span>
        <b>v{view.versions}.0</b>
        <small>
          +{formatNumber(view.bonus * 100)}% · {next}
        </small>
      </p>
    </Tooltip>
  );
}
