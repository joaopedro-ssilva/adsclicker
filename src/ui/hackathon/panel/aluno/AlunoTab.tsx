import type { HackathonProfile } from '@/shared/hackathonApi';
import { Section } from '@/ui/game/panel/lib/Section';
import { CafeCard } from './CafeCard';
import { ClassroomBonuses } from './ClassroomBonuses';
import { EquipmentSlots } from './EquipmentSlots';
import { LifetimeTotals } from './LifetimeTotals';
import { MetaBonuses } from './MetaBonuses';
import { SetBonuses } from './SetBonuses';
import { StatGrid } from './StatGrid';
import { StudentCard } from './StudentCard';

interface AlunoTabProps {
  profile: HackathonProfile;
  onOpenItem: (id: string) => void;
}

/** The student: who they are, what they carry and what it adds up to. */
export function AlunoTab({ profile, onOpenItem }: AlunoTabProps) {
  return (
    <>
      <StudentCard profile={profile} />
      <CafeCard profile={profile} />
      <Section title="Atributos">
        <StatGrid profile={profile} />
      </Section>
      <Section title="Equipamento">
        <EquipmentSlots profile={profile} onOpenItem={onOpenItem} />
      </Section>
      <Section title="Bônus de conjunto">
        <SetBonuses profile={profile} />
      </Section>
      <Section title="Outros bônus">
        <MetaBonuses profile={profile} />
      </Section>
      <Section title="Na sala de aula">
        <ClassroomBonuses profile={profile} />
      </Section>
      <Section title="Carreira">
        <LifetimeTotals profile={profile} />
      </Section>
    </>
  );
}
