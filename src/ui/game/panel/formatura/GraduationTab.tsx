import type { ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { content, useGame, useMaestriasView, useMonitorsView, usePrestigeNodeViews } from '@/game/store';
import { PROFESSOR_IDS } from '@/game/content/types';
import { Collapsible } from '@/ui/kit';
import { GraduationMural } from './GraduationMural';
import { GraduationSummary } from './GraduationSummary';
import { HonourPicker } from './HonourPicker';
import { MaestriasSection } from './maestrias/MaestriasSection';
import { MonitorsSection } from './monitors/MonitorsSection';
import { PrestigeTree } from './PrestigeTree';
import { ResetInfo } from './ResetInfo';
import { TreeReset } from './TreeReset';
import { useSections, type SectionId } from './sectionsStore';
import { useHonourPick } from './honourPick';

interface FoldProps {
  id: SectionId;
  title: string;
  summary: ReactNode;
  attention?: boolean;
  attentionLabel?: string;
  children: ReactNode;
}

/** One collapsible block of the tab; closed until the player opens it, and remembered on this device. */
function Fold({ id, ...rest }: FoldProps) {
  const open = useSections((store) => store.open[id] === true);
  const setOpen = useSections((store) => store.setOpen);
  return <Collapsible {...rest} open={open} onOpenChange={(next) => setOpen(id, next)} testId={`formatura-${id}`} />;
}

function MaestriasFold() {
  const view = useMaestriasView();
  if (!view.visible) return null;
  const { free, used } = view.slots;
  const summary = free > 0 ? `${free} ${free === 1 ? 'vaga livre' : 'vagas livres'}` : `${used} em uso`;
  const attention = free > 0 || view.cards.some((card) => card.affordable);
  return (
    <Fold
      id="maestrias"
      title="Maestrias"
      summary={summary}
      attention={attention}
      attentionLabel={free > 0 ? 'vaga livre' : 'nível para comprar'}
    >
      <MaestriasSection />
    </Fold>
  );
}

function HonourFold() {
  const hired = useGame(useShallow((store) => PROFESSOR_IDS.filter((id) => store.state.hired[id])));
  const current = useGame((store) => store.state.honoured);
  const pick = useHonourPick((store) => store.pick);
  const chosen = pick && hired.includes(pick) ? pick : null;
  const summary = chosen
    ? `${content.professors[chosen].name} (escolhido)`
    : current
      ? `Agora: ${content.professors[current].name}`
      : 'Opcional, ninguém escolhido';
  return (
    <Fold id="honour" title="Professor homenageado" summary={summary}>
      <HonourPicker />
    </Fold>
  );
}

function MonitorsFold() {
  const view = useMonitorsView();
  const hired = view.monitors.filter((monitor) => monitor.level > 0).length;
  const summary = view.unlocked ? `${hired} de ${view.monitors.length} contratados` : 'Depois da 1ª Formatura';
  const attention = view.unlocked && view.monitors.some((monitor) => monitor.affordable);
  return (
    <Fold id="monitors" title="Monitores" summary={summary} attention={attention} attentionLabel="monitor para contratar">
      <MonitorsSection />
    </Fold>
  );
}

function TreeFold() {
  const views = usePrestigeNodeViews();
  const levels = views.reduce((sum, view) => sum + view.level, 0);
  const total = views.reduce((sum, view) => sum + view.maxLevel, 0);
  const attention = views.some((view) => view.affordable);
  return (
    <Fold
      id="tree"
      title="Árvore de diplomas"
      summary={`${levels} de ${total} níveis`}
      attention={attention}
      attentionLabel="nó para comprar"
    >
      <p className="formatura-hint">Toque num nó</p>
      <PrestigeTree />
      <TreeReset />
    </Fold>
  );
}

function MuralFold() {
  const count = useGame((store) => store.state.graduationHistory.length);
  return (
    <Fold id="mural" title="Mural de formaturas" summary={count > 0 ? `${count} ${count === 1 ? 'turma' : 'turmas'}` : 'Nenhuma ainda'}>
      <GraduationMural />
    </Fold>
  );
}

/** Prestige: the diplomas and the graduate button always show; the rest folds away, closed on a first visit. */
export function GraduationTab() {
  return (
    <div className="graduation-tab">
      <GraduationSummary />
      <MaestriasFold />
      <HonourFold />
      <Fold id="reset" title="O que volta e o que fica" summary="Aulas e ADScoins voltam; diplomas e árvore ficam">
        <ResetInfo />
      </Fold>
      <MonitorsFold />
      <TreeFold />
      <MuralFold />
    </div>
  );
}
