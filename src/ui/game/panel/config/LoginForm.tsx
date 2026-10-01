import { useState, type FormEvent } from 'react';
import { useCloud } from '@/game/cloud';
import { NICKNAME_MAX, PASSWORD_MAX } from '@/shared/api';
import { Button } from '@/ui/kit';
import { AccountField } from './AccountField';
import { useAccountAction } from './useAccountAction';

/** "Já tenho conta": nickname and password, to bring an account's progress to this device. */
export function LoginForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const login = useCloud((store) => store.login);
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const { pending, error, run } = useAccountAction();
  const ready = nickname.trim().length > 0 && password.length > 0;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready || pending) return;
    if (await run(() => login(nickname.trim(), password))) onDone();
  };

  return (
    <form className="account-form" onSubmit={submit} noValidate>
      <AccountField
        label="Apelido"
        value={nickname}
        onChange={setNickname}
        autoComplete="username"
        maxLength={NICKNAME_MAX}
        testId="login-nickname-input"
      />
      <AccountField
        label="Senha"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        maxLength={PASSWORD_MAX}
        testId="login-password-input"
      />
      {error ? (
        <p className="save-warning" data-tone="bad" role="alert">
          {error.message}
        </p>
      ) : null}
      <div className="account-actions">
        <Button size="sm" type="submit" disabled={!ready || pending} data-qa="login-submit">
          {pending ? 'Entrando…' : 'Entrar'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
