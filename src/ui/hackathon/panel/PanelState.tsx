import type { HackathonStatus } from '@/ui/hackathon/store';
import { EmptyState, type IconName } from '@/ui/kit';

interface PanelStateProps {
  status: HackathonStatus;
  lockReason: string | null;
}

const COPY: Record<HackathonStatus, { icon: IconName; title: string; text: string }> = {
  idle: { icon: 'clock', title: 'Carregando', text: 'Buscando seu aluno no servidor.' },
  loading: { icon: 'clock', title: 'Carregando', text: 'Buscando seu aluno no servidor.' },
  offline: {
    icon: 'cloud',
    title: 'Hackathon indisponível',
    text: 'O modo precisa de conexão com o servidor. A sala de aula segue normal.',
  },
  locked: { icon: 'lock', title: 'Ainda bloqueado', text: 'Contrate o terceiro professor na sala de aula para liberar o Hackathon.' },
  creating: { icon: 'crown', title: 'Crie seu aluno', text: 'Escolha uma cabeça na arena para começar. O painel abre depois.' },
  ready: { icon: 'check', title: 'Carregando', text: 'Buscando seu aluno no servidor.' },
};

/** What the panel says while the mode is not ready; the stage carries the main message. */
export function PanelState({ status, lockReason }: PanelStateProps) {
  const copy = COPY[status];
  return (
    <div className="hk-quiet" data-status={status}>
      <EmptyState icon={copy.icon} title={copy.title}>
        {status === 'locked' && lockReason ? lockReason : copy.text}
      </EmptyState>
    </div>
  );
}
