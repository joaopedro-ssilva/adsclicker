import { useMemo } from 'react';
import type { StageDef } from '@/hackathon/content';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { Badge } from '@/ui/kit';
import { Commits } from '../lib/Commits';
import { cargoById, HK } from '../lib/hk';
import { whole } from '../lib/labels';
import { DropStrip } from './DropStrip';
import { EnemyStrip } from './EnemyStrip';
import { StartControls } from './StartControls';
import { stageLock } from './stageAccess';

interface StageDetailProps {
  stage: StageDef;
  profile: HackathonProfile;
}

/** The selected stage: what is in it, what it pays, and the start controls. The boss reads as the promotion fight. */
export function StageDetail({ stage, profile }: StageDetailProps) {
  const found = useMemo(() => new Set(profile.collection), [profile.collection]);
  const clears = profile.stages[stage.id]?.clears ?? 0;
  const cargo = cargoById.get(profile.cargo);
  const promotes = stage.boss && cargo?.promotionStage === stage.id;
  const next = cargo ? HK.cargos.find((entry) => entry.order === cargo.order + 1) : undefined;

  return (
    <section className="hk-stage-detail" data-boss={stage.boss} data-qa="hk-stage-detail" aria-label={`Fase ${stage.order}: ${stage.name}`}>
      <div className="hk-detail-main">
        <div className="hk-stage-detail-title">
          <h3>{stage.name}</h3>
          {stage.boss ? <Badge tone="warn">Promoção</Badge> : null}
        </div>
        <p className="hk-detail-text">{stage.description}</p>
        {stage.boss ? (
          <p className="hk-promo" data-done={!promotes}>
            {promotes
              ? `Vença o chefão para ser promovido a ${next?.name ?? 'o próximo cargo'}. Ele dá 2 itens.`
              : 'Você já passou por esta promoção. O chefão continua rendendo 2 itens por vitória.'}
          </p>
        ) : null}
        {clears === 0 ? (
          <p className="hk-note">Primeira vitória: item garantido de raridade incomum ou melhor e Commits em dobro.</p>
        ) : null}
      </div>

      <dl className="hk-stage-facts">
        <div>
          <dt>Nível da fase</dt>
          <dd>{stage.level}</dd>
        </div>
        <div>
          <dt>Pede nível</dt>
          <dd>{stage.requiredLevel}</dd>
        </div>
        <div>
          <dt>Vitórias</dt>
          <dd>{clears}</dd>
        </div>
        <div className="hk-fact-wide">
          <dt>Recompensa</dt>
          <dd>
            {whole(stage.xp)} XP · <Commits amount={stage.commits} />
          </dd>
        </div>
      </dl>

      <div className="hk-detail-lists">
        <div>
          <h4>Inimigos</h4>
          <EnemyStrip waves={stage.waves} />
        </div>
        <div>
          <h4>Pode derrubar</h4>
          <DropStrip drops={stage.drops} found={found} />
        </div>
      </div>

      <StartControls stageId={stage.id} profile={profile} lock={stageLock(stage, profile)} qa="hk-start" autoQa="hk-auto" />
    </section>
  );
}
