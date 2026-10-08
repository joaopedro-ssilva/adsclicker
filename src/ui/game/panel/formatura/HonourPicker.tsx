import { useShallow } from 'zustand/react/shallow';
import { content, useGame } from '@/game/store';
import { masteryRank } from '@/game/engine/views';
import { PROFESSOR_IDS } from '@/game/content/types';
import { themeVariables } from '@/ui/ThemeProvider';
import { Section } from '../lib/Section';
import { Portrait } from '../lib/Portrait';
import { useHonourPick } from './honourPick';

/**
 * Optional pick at graduation: one hired professor gets a stronger mechanic for the next turma.
 * Tap the chosen one again to take the pick back. Nobody is chosen by default.
 */
export function HonourPicker() {
  const hired = useGame(useShallow((store) => PROFESSOR_IDS.filter((id) => store.state.hired[id])));
  // Primitives only, so the selectors can be compared shallowly.
  const ranks = useGame(useShallow((store) => PROFESSOR_IDS.map((id) => masteryRank(store.state, content, id))));
  const options = hired.map((id) => ({ id, rank: ranks[PROFESSOR_IDS.indexOf(id)] ?? 0 }));
  const current = useGame((store) => store.state.honoured);
  const pick = useHonourPick((store) => store.pick);
  const setPick = useHonourPick((store) => store.setPick);
  const chosen = options.some((option) => option.id === pick) ? pick : null;

  const now = current ? content.mastery[current].honour.name : null;

  return (
    <Section title="Professor homenageado" note={chosen ? '1 escolhido' : 'Opcional'}>
      <div className="honour" data-qa="honour-picker">
        <p className="honour-intro">
          Escolha quem a turma vai homenagear: a mecânica dele fica mais forte na próxima turma.
          {current && now ? ` Agora: ${content.professors[current].name}, ${now.toLowerCase()}.` : ''}
        </p>
        <div className="honour-list" role="radiogroup" aria-label="Professor homenageado">
          {options.map(({ id, rank }) => {
            const def = content.professors[id];
            const honour = content.mastery[id].honour;
            const selected = chosen === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                className="honour-option"
                data-selected={selected}
                data-current={current === id}
                data-qa={`honour-${id}`}
                style={themeVariables(undefined, def.color)}
                onClick={() => setPick(selected ? null : id)}
              >
                <Portrait professor={id} />
                <span className="honour-text">
                  <strong>
                    {def.name} <em>{honour.name}</em>
                  </strong>
                  <span>{honour.description}</span>
                </span>
                <span className="honour-rank" title="Domínio atual">
                  {rank}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
