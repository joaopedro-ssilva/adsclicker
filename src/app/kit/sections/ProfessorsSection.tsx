'use client';
import { useState } from 'react';
import { Character } from '@/ui/art/Character';
import { IconButton, Panel } from '@/ui/kit';
import { cssVariables } from '@/ui/theme';
import { defaultSkin, professors } from '../data';
import { SectionHeading } from '../parts/SectionHeading';

/** The eight real professors, composed from the real head and body art. */
export function ProfessorsSection() {
  const [bumps, setBumps] = useState<Record<string, number>>({});

  return (
    <section className="kit-section" aria-labelledby="turma">
      <SectionHeading id="turma" number="03" title="A turma de verdade" note="Cabeça grande sobre corpo pequeno, camadas independentes." />
      <div className="character-gallery">
        {professors.map((professor) => {
          const skin = defaultSkin(professor.id);
          return (
            <Panel key={professor.id} className="character-card" style={cssVariables({ '--accent': professor.color })}>
              <div className="character-podium">
                <Character
                  body={skin?.body}
                  head={`heads/${professor.id}`}
                  palette={skin?.palette ?? { primary: professor.color, secondary: '#3a4458', accent: '#e8cfab' }}
                  seed={professor.id}
                  scale={2}
                  bump={bumps[professor.id] ?? 0}
                  label={professor.name}
                />
              </div>
              <div className="character-meta">
                <div>
                  <h3>{professor.name}</h3>
                  <p className="muted">{professor.subject}</p>
                </div>
                <IconButton
                  icon="click"
                  label={`Animar ${professor.name}`}
                  size="sm"
                  variant="secondary"
                  onClick={() => setBumps((current) => ({ ...current, [professor.id]: (current[professor.id] ?? 0) + 1 }))}
                />
              </div>
            </Panel>
          );
        })}
      </div>
    </section>
  );
}
