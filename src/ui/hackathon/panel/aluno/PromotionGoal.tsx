import type { HackathonProfile } from '@/shared/hackathonApi';
import { Icon } from '@/ui/kit';
import { Card } from '../../screen/Card';
import { cargoById, HK, stageById } from '../lib/hk';

/** What the next cargo asks: the level and the promotion fight, each ticked when done. */
export function PromotionGoal({ profile }: { profile: HackathonProfile }) {
  const cargo = cargoById.get(profile.cargo);
  const next = cargo ? HK.cargos.find((entry) => entry.order === cargo.order + 1) : undefined;
  const stage = cargo?.promotionStage ? stageById.get(cargo.promotionStage) : undefined;

  if (!cargo || !next || !stage) {
    return (
      <Card title="Próximo cargo" icon="crown" qa="hk-promotion" className="hk-goal">
        <p className="hk-note">Você está no cargo mais alto desta versão do Hackathon.</p>
      </Card>
    );
  }

  const levelDone = profile.level >= stage.requiredLevel;
  const fightDone = (profile.stages[stage.id]?.clears ?? 0) > 0;
  return (
    <Card title="Próximo cargo" icon="crown" qa="hk-promotion" className="hk-goal">
      <p className="hk-goal-name">{next.name}</p>
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
    </Card>
  );
}
