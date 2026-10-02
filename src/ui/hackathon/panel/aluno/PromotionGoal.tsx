import type { HackathonProfile } from '@/shared/hackathonApi';
import { Icon } from '@/ui/kit';
import { cargoById, HK, stageById } from '../lib/hk';

/** What the next cargo asks: the level and the promotion fight, each ticked when done. */
export function PromotionGoal({ profile }: { profile: HackathonProfile }) {
  const cargo = cargoById.get(profile.cargo);
  const next = cargo ? HK.cargos.find((entry) => entry.order === cargo.order + 1) : undefined;
  const stage = cargo?.promotionStage ? stageById.get(cargo.promotionStage) : undefined;

  if (!cargo || !next || !stage) {
    return <p className="hk-note">Você está no cargo mais alto desta versão do Hackathon.</p>;
  }

  const levelDone = profile.level >= stage.requiredLevel;
  const fightDone = (profile.stages[stage.id]?.clears ?? 0) > 0;
  return (
    <div className="hk-goal" data-qa="hk-promotion">
      <p className="hk-goal-title">
        Próximo cargo: <strong>{next.name}</strong>
      </p>
      <ul>
        <li data-done={levelDone}>
          <Icon name={levelDone ? 'check' : 'lock'} size={12} />
          Chegar ao nível {stage.requiredLevel}
        </li>
        <li data-done={fightDone}>
          <Icon name={fightDone ? 'check' : 'lock'} size={12} />
          Vencer o chefão “{stage.name}”
        </li>
      </ul>
    </div>
  );
}
