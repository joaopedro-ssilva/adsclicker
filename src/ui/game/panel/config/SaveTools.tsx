import { useRef, useState, type ChangeEvent } from 'react';
import { useGame } from '@/game/store';
import { audio } from '@/ui/audio';
import { Button, Icon, toast } from '@/ui/kit';
import { Section } from '../lib/Section';

const MAX_FILE_BYTES = 5_000_000;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function download(text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const link = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `adsclicker-save-${stamp}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Export (copy or file) and import (paste or file) of the save. Importing replaces the game, so it asks twice. */
export function SaveTools() {
  const exportSave = useGame((store) => store.exportSave);
  const importSave = useGame((store) => store.importSave);
  const [fallback, setFallback] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const copy = async () => {
    const data = exportSave();
    if (await copyText(data)) {
      setFallback(null);
      toast({ title: 'Save copiado', description: 'Cole em um lugar seguro.', tone: 'good', emoji: '📋' });
    } else {
      setFallback(data); // clipboard blocked: show the text to copy by hand
    }
  };

  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError('Arquivo grande demais para ser um save.');
      return;
    }
    setText(await file.text());
    setArmed(false);
    setError(null);
  };

  const runImport = () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    if (importSave(text)) {
      audio.play('unlock');
      toast({ title: 'Save importado', description: 'Seu progresso foi substituído.', tone: 'good', emoji: '💾' });
      setText('');
      setArmed(false);
      setError(null);
    } else {
      audio.play('cantAfford');
      setError('Esse texto não é um save válido.');
      setArmed(false);
    }
  };

  return (
    <Section title="Save">
      <div className="setting-group save-tools">
        <div className="save-block">
          <h3>Exportar</h3>
          <p className="setting-hint">O jogo salva sozinho no navegador. Exporte para guardar uma cópia ou jogar em outro lugar.</p>
          <div className="save-actions">
            <Button size="sm" variant="secondary" data-qa="save-copy" onClick={copy}>
              <Icon name="plus" size={12} />
              Copiar
            </Button>
            <Button size="sm" variant="secondary" data-qa="save-download" onClick={() => download(exportSave())}>
              <Icon name="arrowUp" size={12} />
              Baixar arquivo
            </Button>
          </div>
          {fallback ? (
            <textarea
              className="save-text"
              readOnly
              rows={3}
              value={fallback}
              aria-label="Texto do save para copiar"
              onFocus={(event) => event.currentTarget.select()}
            />
          ) : null}
        </div>

        <div className="save-block">
          <h3>Importar</h3>
          <textarea
            className="save-text"
            rows={3}
            value={text}
            placeholder="Cole aqui o texto do save"
            aria-label="Texto do save a importar"
            data-qa="save-import-text"
            onChange={(event) => {
              setText(event.target.value);
              setArmed(false);
              setError(null);
            }}
          />
          <div className="save-actions">
            <Button size="sm" variant="secondary" onClick={() => picker.current?.click()}>
              Escolher arquivo
            </Button>
            <Button
              size="sm"
              variant={armed ? 'danger' : 'primary'}
              disabled={text.trim().length === 0}
              data-qa="save-import"
              onClick={runImport}
            >
              {armed ? 'Confirmar: substituir progresso' : 'Importar'}
            </Button>
            <input ref={picker} type="file" accept=".txt,.json,text/plain,application/json" hidden onChange={readFile} />
          </div>
          {armed ? <p className="save-warning">Isso apaga o progresso atual e usa o do texto. Toque de novo para confirmar.</p> : null}
          {error ? (
            <p className="save-warning" role="alert" data-tone="bad">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </Section>
  );
}
