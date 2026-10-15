import { content, useGame } from '@/game/store';
import { formatDuration } from '@/game/engine/format';
import { themeVariables } from '@/ui/ThemeProvider';
import { Section } from '../lib/Section';
import { Portrait } from '../lib/Portrait';
import { fmtInt } from '../lib/numbers';

/** Mural de formaturas: the last graduations, newest first, with the professor honoured during each run. */
export function GraduationMural() {
  const history = useGame((store) => store.state.graduationHistory);

  return (
    <Section title="Mural de formaturas" note={history.length > 0 ? `Últimas ${history.length}` : undefined}>
      {history.length === 0 ? (
        <p className="mural-empty" data-qa="mural-empty">
          Nenhuma turma formada ainda. Cada formatura fica registrada aqui.
        </p>
      ) : (
        <ol className="mural" data-qa="mural">
          {history.map((entry) => {
            const professor = entry.honoured ? content.professors[entry.honoured] : null;
            return (
              <li
                key={`${entry.number}-${entry.at}`}
                className="mural-row"
                data-qa="mural-row"
                style={themeVariables(undefined, professor?.color)}
              >
                <span className="mural-number">Turma {fmtInt(entry.number)}</span>
                {entry.honoured ? <Portrait professor={entry.honoured} /> : <span className="mural-nobody" aria-hidden="true" />}
                <span className="mural-text">
                  <strong>
                    {fmtInt(entry.diplomas)} {entry.diplomas === 1 ? 'diploma' : 'diplomas'}
                    <em>{formatDuration(entry.seconds * 1000)}</em>
                  </strong>
                  <span>
                    {professor && entry.honoured
                      ? `${professor.name}, ${content.mastery[entry.honoured].honour.name.toLowerCase()}`
                      : 'Sem homenagem'}
                  </span>
                  {entry.capped || entry.treeReset ? (
                    <span className="mural-tags">
                      {entry.capped ? <b className="mural-tag">Teto</b> : null}
                      {entry.treeReset ? <b className="mural-tag">Árvore resetada</b> : null}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Section>
  );
}
