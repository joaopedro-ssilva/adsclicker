'use client';
import { Scenery } from '@/ui/art/Scenery';
import { Arena } from '../arena/Arena';
import { ArenaHud } from '../arena/ArenaHud';
import { NoticeView } from '../arena/NoticeView';
import { RewardsScreen } from '../arena/RewardsScreen';
import { StudentCreation } from '../arena/StudentCreation';
import { HubView } from '../hub/HubView';
import { StagesWindow } from '../panel/fases/StagesWindow';
import { SkillsWindow } from '../panel/habilidades/SkillsWindow';
import { ItemsWindow } from '../panel/itens/ItemsWindow';
import { MentorsWindow } from '../panel/mentores/MentorsWindow';
import { useHackathon } from '../store';
import { TabNav } from './TabNav';
import { TopBar } from './TopBar';
import { useHackathonUi } from './uiStore';

const ARENA_SCENERY = {
  id: 'hackathon-arena',
  name: 'Laboratório',
  asset: 'hackathon/arenas/capitulo-1',
  palette: { sky: '#10142a', horizon: '#1c2440', floor: '#2b3156' },
};

type ViewKind = 'fight' | 'rewards' | 'hub' | 'window' | 'notice';

/**
 * The whole Hackathon mode, full screen over the arena: a top bar, then the fight, the rewards,
 * the hub (the student tab) or one of the windows. There is no side panel in this mode.
 */
export function HackathonScreen() {
  const status = useHackathon((store) => store.status);
  const lockReason = useHackathon((store) => store.lockReason);
  const profile = useHackathon((store) => store.profile);
  const run = useHackathon((store) => store.run);
  const lastResult = useHackathon((store) => store.lastResult);
  const pending = useHackathon((store) => store.pending);
  const load = useHackathon((store) => store.load);
  const tab = useHackathonUi((store) => store.tab);

  let kind: ViewKind = 'notice';
  let view;
  if (run) {
    kind = 'fight';
    view = <Arena run={run} />;
  } else if (status === 'ready' && profile && lastResult) {
    kind = 'rewards';
    view = <RewardsScreen result={lastResult} />;
  } else if (status === 'ready' && profile) {
    kind = tab === 'aluno' ? 'hub' : 'window';
    if (tab === 'aluno') view = <HubView profile={profile} />;
    else if (tab === 'itens') view = <ItemsWindow profile={profile} />;
    else if (tab === 'habilidades') view = <SkillsWindow profile={profile} />;
    else if (tab === 'mentores') view = <MentorsWindow profile={profile} />;
    else view = <StagesWindow profile={profile} />;
  } else if (status === 'creating') {
    view = <StudentCreation />;
  } else if (status === 'locked') {
    view = (
      <NoticeView
        emoji="🔒"
        icon="lock"
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
        icon="cloud"
        title="O Hackathon precisa de conexão"
        text="Seu aluno, itens e Commits ficam guardados no servidor. A sala de aula continua funcionando normalmente."
        actionLabel="Tentar de novo"
        onAction={() => void load()}
      />
    );
  } else {
    view = <NoticeView emoji="☕" icon="clock" title="Abrindo o Hackathon..." text="Buscando o seu aluno." />;
  }

  const browsing = kind === 'hub' || kind === 'window';
  const scenery = run ? { ...ARENA_SCENERY, asset: run.stage.arena } : ARENA_SCENERY;

  return (
    <section className="stage-root hx-screen" aria-label="Hackathon">
      <Scenery scenery={scenery} focusY={0.9} className="stage-scenery">
        <div className="hx-ui" data-view={kind}>
          <TopBar>{run ? <ArenaHud run={run} /> : browsing ? <TabNav placement="top" /> : null}</TopBar>
          <div className="hx-body">{view}</div>
          {browsing ? <TabNav placement="bottom" /> : null}
        </div>
      </Scenery>
    </section>
  );
}
