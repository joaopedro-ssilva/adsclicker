import type { HackathonProfile } from '@/shared/hackathonApi';
import { ProgressBar } from '@/ui/kit';
import { baseById, CAMPAIGN } from '../lib/hk';
import { ItemIcon } from '../lib/ItemIcon';

/** Every base the chapter can drop, stage by stage: found ones in colour, the rest as a silhouette. */
export function CollectionView({ profile }: { profile: HackathonProfile }) {
  const found = new Set(profile.collection);
  const chapterBases = [...new Set(CAMPAIGN.flatMap((stage) => stage.drops))];
  const chapterFound = chapterBases.filter((id) => found.has(id)).length;

  return (
    <div className="hk-collection" data-qa="hk-collection">
      <div className="hk-collection-total">
        <ProgressBar
          label="Capítulo 1"
          value={chapterFound}
          max={Math.max(1, chapterBases.length)}
          valueLabel={`${chapterFound}/${chapterBases.length} · ${Math.round((chapterFound / Math.max(1, chapterBases.length)) * 100)}%`}
          segmented
          segments={24}
          tone="good"
        />
      </div>
      <div className="hk-collection-stages">
        {CAMPAIGN.map((stage) => {
          const stageFound = stage.drops.filter((id) => found.has(id)).length;
          return (
            <section key={stage.id} className="hk-collection-stage" data-done={stageFound === stage.drops.length}>
              <header>
                <h3>
                  {stage.order}. {stage.name}
                </h3>
                <span>
                  {stageFound}/{stage.drops.length}
                </span>
              </header>
              <ul>
                {stage.drops.map((id) => {
                  const base = baseById.get(id);
                  const known = found.has(id);
                  return (
                    <li key={id} data-known={known}>
                      <span className="hk-frame hk-collection-frame" data-empty={!known}>
                        {base ? <ItemIcon asset={base.asset} scale={2} hidden={!known} /> : null}
                      </span>
                      <span className="hk-collection-name">{known ? base?.name : '???'}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
