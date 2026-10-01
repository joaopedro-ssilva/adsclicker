'use client';
import { useState } from 'react';
import type { ProfessorId } from '@/game/content/types';
import { FxLayer } from '@/ui/fx';
import { ToastStack } from '@/ui/kit';
import { ThemeProvider } from '@/ui/ThemeProvider';
import { professors, themes } from './data';
import { AudioSection } from './sections/AudioSection';
import { ComponentsSection } from './sections/ComponentsSection';
import { ControlPanel } from './sections/ControlPanel';
import { FallbackSection } from './sections/FallbackSection';
import { FxSection } from './sections/FxSection';
import { IdentitySection } from './sections/IdentitySection';
import { KitFooter } from './sections/KitFooter';
import { KitHeader } from './sections/KitHeader';
import { KitHero } from './sections/KitHero';
import { ProfessorsSection } from './sections/ProfessorsSection';
import { ScenerySection } from './sections/ScenerySection';
import { StagePreview } from './sections/StagePreview';

/** The review page for the design system: every piece, in every state, under a live accent and theme. */
export function KitShowcase() {
  const [professorId, setProfessorId] = useState<ProfessorId>('edecio');
  const [themeId, setThemeId] = useState(themes.find((theme) => theme.default)?.id ?? themes[0]?.id ?? '');
  const [reducedMotion, setReducedMotion] = useState(false);

  const professor = professors.find((entry) => entry.id === professorId) ?? professors[0];
  const theme = themes.find((entry) => entry.id === themeId);
  if (!professor) return null;

  return (
    <ThemeProvider theme={theme} accent={professor.color} reducedMotion={reducedMotion}>
      <a className="skip-link" href="#laboratorio">
        Pular para o laboratório
      </a>
      <KitHeader />
      <main className="kit-shell" id="laboratorio" data-shake-root>
        <KitHero />
        <div className="preview-grid">
          <StagePreview professor={professor} />
          <ControlPanel
            professors={professors}
            professorId={professorId}
            onProfessor={setProfessorId}
            themes={themes}
            themeId={themeId}
            onTheme={setThemeId}
            reducedMotion={reducedMotion}
            onReducedMotion={setReducedMotion}
          />
        </div>
        <ComponentsSection professorId={professor.id} />
        <IdentitySection />
        <ProfessorsSection />
        <FallbackSection />
        <ScenerySection />
        <FxSection />
        <AudioSection />
        <KitFooter />
      </main>
      <ToastStack />
      <FxLayer />
    </ThemeProvider>
  );
}
