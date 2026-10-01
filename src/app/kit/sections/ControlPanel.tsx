import type { ProfessorDef, ProfessorId, ThemeDef } from '@/game/content/types';
import { audio } from '@/ui/audio';
import { Panel } from '@/ui/kit';
import { cssVariables } from '@/ui/theme';
import { HeadThumb } from '../parts/HeadThumb';

export interface ControlPanelProps {
  professors: ProfessorDef[];
  professorId: ProfessorId;
  onProfessor: (id: ProfessorId) => void;
  themes: ThemeDef[];
  themeId: string;
  onTheme: (id: string) => void;
  reducedMotion: boolean;
  onReducedMotion: (value: boolean) => void;
}

export function ControlPanel({
  professors,
  professorId,
  onProfessor,
  themes,
  themeId,
  onTheme,
  reducedMotion,
  onReducedMotion,
}: ControlPanelProps) {
  return (
    <Panel className="control-panel">
      <h2>Sua turma, seu tom</h2>
      <p className="muted">O professor em sala tinge toda a interface. O tema troca só as cores base.</p>

      <p className="field-label" id="professor-label">
        Professor em sala
      </p>
      <div className="professor-options" role="group" aria-labelledby="professor-label">
        {professors.map((professor) => (
          <button
            type="button"
            key={professor.id}
            className="professor-option"
            style={cssVariables({ '--option-color': professor.color })}
            aria-pressed={professor.id === professorId}
            onClick={() => {
              onProfessor(professor.id);
              audio.play('uiTap');
            }}
          >
            <HeadThumb professorId={professor.id} />
            <span>{professor.name}</span>
          </button>
        ))}
      </div>

      <p className="field-label" id="theme-label">
        Tema da interface
      </p>
      <div className="theme-options" role="group" aria-labelledby="theme-label">
        {themes.map((theme) => (
          <button
            type="button"
            key={theme.id}
            className="theme-option"
            aria-pressed={theme.id === themeId}
            onClick={() => {
              onTheme(theme.id);
              audio.play('uiTap');
            }}
          >
            <span className="theme-swatches" aria-hidden="true">
              {[theme.colors.bg, theme.colors.surfaceRaised, theme.colors.border, theme.colors.text].map((color, index) => (
                <i key={index} style={{ background: color }} />
              ))}
            </span>
            {theme.name}
          </button>
        ))}
      </div>

      <label className="toggle-field">
        Reduzir movimento
        <input type="checkbox" checked={reducedMotion} onChange={(event) => onReducedMotion(event.target.checked)} />
      </label>
    </Panel>
  );
}
