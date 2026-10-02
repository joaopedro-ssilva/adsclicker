'use client';
import { useHackathon } from '../store';
import { Arena } from './Arena';
import { Lobby } from './Lobby';
import { NoticeView } from './NoticeView';
import { RewardsScreen } from './RewardsScreen';
import { StageFrame } from './StageFrame';
import { StudentCreation } from './StudentCreation';

/** The Hackathon's half of the screen: whichever of offline, locked, creation, lobby, fight or rewards applies. */
export function HackathonStage() {
  const status = useHackathon((store) => store.status);
  const lockReason = useHackathon((store) => store.lockReason);
  const run = useHackathon((store) => store.run);
  const lastResult = useHackathon((store) => store.lastResult);
  const pending = useHackathon((store) => store.pending);
  const load = useHackathon((store) => store.load);

  let view;
  if (run) view = <Arena run={run} />;
  else if (status === 'ready' && lastResult) view = <RewardsScreen result={lastResult} />;
  else if (status === 'ready') view = <Lobby />;
  else if (status === 'creating') view = <StudentCreation />;
  else if (status === 'locked') {
    view = (
      <NoticeView
        emoji="🔒"
        title="Hackathon bloqueado"
        text={lockReason ?? 'O Hackathon ainda não está liberado.'}
        actionLabel="Verificar de novo"
        onAction={() => void load()}
        busy={pending}
      />
    );
  } else if (status === 'offline') {
    view = (
      <NoticeView
        emoji="📡"
        title="O Hackathon precisa de conexão"
        text="Seu aluno, itens e Commits ficam guardados no servidor. A sala de aula continua funcionando normalmente."
        actionLabel="Tentar de novo"
        onAction={() => void load()}
      />
    );
  } else {
    view = <NoticeView emoji="☕" title="Abrindo o Hackathon..." text="Buscando o seu aluno." />;
  }

  return <StageFrame arena={run?.stage.arena}>{view}</StageFrame>;
}
