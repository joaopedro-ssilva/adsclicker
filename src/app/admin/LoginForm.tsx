'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { Button, Panel } from '@/ui/kit';
import { ThemeProvider } from '@/ui/ThemeProvider';
import { login } from './actions';
import type { LoginState } from './actions';

const INITIAL: LoginState = { error: null };

/** The gate in front of the admin tools. */
export function LoginForm() {
  const [state, submit, pending] = useActionState(login, INITIAL);

  return (
    <ThemeProvider>
      <main className="admin">
        <header className="admin-head">
          <p className="eyebrow">ADSClicker</p>
          <h1>Admin</h1>
        </header>

        <Panel className="admin-card">
          <h2>Entrar</h2>
          <form className="admin-login" action={submit}>
            <label htmlFor="admin-user">Usuário</label>
            <input id="admin-user" name="user" autoComplete="username" required autoFocus />
            <label htmlFor="admin-password">Senha</label>
            <input id="admin-password" name="password" type="password" autoComplete="current-password" required />
            {state.error ? (
              <p className="admin-error" role="alert">
                {state.error}
              </p>
            ) : null}
            <Button type="submit" disabled={pending}>
              {pending ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
        </Panel>

        <Link className="ui-button" data-variant="secondary" href="/">
          Voltar ao jogo
        </Link>
      </main>
    </ThemeProvider>
  );
}
