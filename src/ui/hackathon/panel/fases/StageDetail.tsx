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
  auto: boolean;
  onAuto: (value: boolean) => void;
}

/** The selected stage: what is in it, what it pays, and the start controls. The boss reads as the promotion fight. */
export function StageDetail({ stage, profile, auto, onAuto }: StageDetailProps) {
  const found = useMemo(() => new Set(profile.collection), [profile.collection]);
  const clears = profile.stages[stage.id]?.clears ?? 0;
  const cargo = cargoById.get(profile.cargo);
  const promotes = stage.boss && cargo?.promotionStage === stage.id;
  const next = cargo ? HK.cargos.find((entry) => entry.order === cargo.order + 1) : undefined;

  return (
    <section className="hk-card hk-stage-detail" data-boss={stage.boss} data-qa="hk-stage-detail">
      <header>
        <div className="hk-stage-detail-title">
          <h3>{stage.name}</h3>
          {stage.boss ? <Badge tone="warn">Promoção</Badge> : null}
        </div>
        <p className="hk-note">{stage.description}</p>
      </header>

      {stage.boss ? (
        <p className="hk-promo" data-done={!promotes}>
          {promotes
            ? `Vença o chefão para ser promovido a ${next?.name ?? 'o próximo cargo'}. Ele dá 2 itens.`
            : 'Você já passou por esta promoção. O chefão continua rendendo 2 itens por vitória.'}
        </p>
      ) : null}

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
        <div>
          <dt>Recompensa</dt>
          <dd>
            {whole(stage.xp)} XP · <Commits amount={stage.commits} />
          </dd>
        </div>
      </dl>
      {clears === 0 ? <p className="hk-note">Primeira vitória: item garantido de raridade incomum ou melhor e Commits em dobro.</p> : null}

      <h4>Inimigos</h4>
      <EnemyStrip waves={stage.waves} />
      <h4>Pode derrubar</h4>
      <DropStrip drops={stage.drops} found={found} />

      <StartControls stageId={stage.id} profile={profile} auto={auto} onAuto={onAuto} lock={stageLock(stage, profile)} qa="hk-start" autoQa="hk-auto" />
    </section>
  );
}
