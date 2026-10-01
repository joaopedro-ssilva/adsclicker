'use client';
import { useState } from 'react';
import type { ProfessorId, Rarity } from '@/game/content/types';
import { EmptyState, RarityBadge, Tabs } from '@/ui/kit';
import { LessonRows } from '../parts/LessonRows';
import { Specimen } from '../parts/Specimen';

const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

export function TabsSpecimen({ professorId }: { professorId: ProfessorId }) {
  const [tab, setTab] = useState('aulas');

  return (
    <Specimen title="Abas" code="01.D" className="specimen-wide">
      <Tabs
        label="Exemplo de painel"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'aulas', label: 'Aulas', content: <LessonRows professorId={professorId} /> },
          {
            value: 'pesquisas',
            label: 'Pesquisas',
            dot: true,
            content: (
              <EmptyState title="Uma ideia de cada vez" icon="flask">
                As próximas descobertas da turma aparecem aqui.
              </EmptyState>
            ),
          },
          {
            value: 'album',
            label: 'Álbum',
            content: (
              <div className="stack">
                <h3>Uma coleção com personalidade</h3>
                <div className="row">
                  {RARITIES.map((rarity) => (
                    <RarityBadge key={rarity} rarity={rarity} />
                  ))}
                </div>
              </div>
            ),
          },
          { value: 'formatura', label: 'Formatura', disabled: true, content: null },
        ]}
      />
    </Specimen>
  );
}
