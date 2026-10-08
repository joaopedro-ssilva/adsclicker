import type { HackathonProfile } from '@/shared/hackathonApi';
import { Modal } from '@/ui/kit';
import { ClassroomBonuses } from '../panel/aluno/ClassroomBonuses';
import { LifetimeTotals } from '../panel/aluno/LifetimeTotals';
import { MetaBonuses } from '../panel/aluno/MetaBonuses';
import { SetBonuses } from '../panel/aluno/SetBonuses';

interface DetailsModalProps {
  profile: HackathonProfile;
  open: boolean;
  onClose: () => void;
}

/** Everything the build adds up to beyond the six stats: sets, other bonuses, what the classroom gets, career totals. */
export function DetailsModal({ profile, open, onClose }: DetailsModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Detalhes do aluno" size="lg">
      <div className="hk-panel hk-details">
        <section>
          <h3>Bônus de conjunto</h3>
          <SetBonuses profile={profile} />
        </section>
        <section>
          <h3>Outros bônus</h3>
          <MetaBonuses profile={profile} />
        </section>
        <section>
          <h3>Na sala de aula</h3>
          <ClassroomBonuses profile={profile} />
        </section>
        <section>
          <h3>Carreira</h3>
          <LifetimeTotals profile={profile} />
        </section>
      </div>
    </Modal>
  );
}
