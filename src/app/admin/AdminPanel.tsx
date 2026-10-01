'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatNumber } from '@/game/engine/format';
import { MAX_DEV_MULTIPLIER, MIN_DEV_MULTIPLIER } from '@/game/engine/state';
import { DEV_MULTIPLIER_KEY, readDevMultiplier, writeDevMultiplier } from '@/ui/dev/devMultiplier';
import { Badge, Button, Panel } from '@/ui/kit';
import { ThemeProvider } from '@/ui/ThemeProvider';
import { logout } from './actions';

const PRESETS = [1, 2, 5, 10, 50, 100, 1000];

/**
 * Admin tools. For now a single knob: the global coin multiplier, for demos and quick progression tests.
 * It is stored in this browser only; seeing who is playing needs a backend and comes later.
 */
export function AdminPanel() {
  // null until the browser value is read: the server cannot know it, and rendering "1" first would flash.
  const [multiplier, setMultiplier] = useState<number | null>(null);
  const [custom, setCustom] = useState('');

  useEffect(() => {
    const sync = () => setMultiplier(readDevMultiplier());
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === DEV_MULTIPLIER_KEY) sync();
    };
    sync();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const apply = (value: number) => setMultiplier(writeDevMultiplier(value));
  const customValue = Number(custom.replace(',', '.'));
  const customValid = custom.trim() !== '' && Number.isFinite(customValue) && customValue > 0;

  return (
    <ThemeProvider>
      <main className="admin">
        <header className="admin-head">
          <p className="eyebrow">ADSClicker</p>
          <h1>Admin</h1>
        </header>

        <Panel className="admin-card">
          <div className="admin-card-head">
            <h2>Multiplicador global de ADScoins</h2>
            {multiplier !== null && (
              <Badge tone={multiplier === 1 ? 'neutral' : 'warn'}>
                {multiplier === 1 ? 'Normal' : `Ativo: ×${formatNumber(multiplier)}`}
              </Badge>
            )}
          </div>
          <p className="muted">
            Multiplica tudo o que rende moeda: clique, produção por segundo, invasões e sprints. Vale só neste navegador e
            o jogo aberto em outra aba acompanha na hora, com um selo &quot;Dev&quot; ao lado do saldo.
          </p>

          <div className="admin-presets" role="group" aria-label="Multiplicadores prontos">
            {PRESETS.map((value) => (
              <Button
                key={value}
                variant={multiplier === value ? 'primary' : 'secondary'}
                aria-pressed={multiplier === value}
                onClick={() => apply(value)}
              >
                ×{formatNumber(value)}
              </Button>
            ))}
          </div>

          <form
            className="admin-custom"
            onSubmit={(event) => {
              event.preventDefault();
              if (customValid) apply(customValue);
            }}
          >
            <label htmlFor="admin-custom-value">Outro valor</label>
            <input
              id="admin-custom-value"
              inputMode="decimal"
              placeholder="ex.: 25"
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
            />
            <Button type="submit" disabled={!customValid}>
              Aplicar
            </Button>
          </form>
          <p className="muted admin-hint">
            Aceita de {formatNumber(MIN_DEV_MULTIPLIER)} a {formatNumber(MAX_DEV_MULTIPLIER)}. ×1 desliga.
          </p>
        </Panel>

        <Panel className="admin-card" tone="inset">
          <h2>Quem está jogando</h2>
          <p className="muted">
            Ainda não existe: o jogo salva tudo no navegador de cada pessoa. Listar jogadores e mudar o multiplicador para
            todos de uma vez precisa de banco de dados e login, que entram junto com o backend.
          </p>
        </Panel>

        <div className="admin-actions">
          <Link className="ui-button" data-variant="secondary" href="/">
            Voltar ao jogo
          </Link>
          <form action={logout}>
            <Button type="submit" variant="ghost">
              Sair
            </Button>
          </form>
        </div>
      </main>
    </ThemeProvider>
  );
}
