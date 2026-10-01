import { useState, type FormEvent } from 'react';
import { useCloud } from '@/game/cloud';
import { PASSWORD_MAX, passwordSchema } from '@/shared/api';
import { Button } from '@/ui/kit';
import { AccountField } from './AccountField';
import { useAccountAction } from './useAccountAction';
import { firstIssue } from './validate';

interface PasswordFormProps {
  /** Changing an existing password asks for the current one first. */
  change: boolean;
  onDone: () => void;
  onCancel: () => void;
}

/** Sets a password (so the account works on another device) or changes the existing one. */
export function PasswordForm({ change, onDone, onCancel }: PasswordFormProps) {
  const setPassword = useCloud((store) => store.setPassword);
  const [current, setCurrent] = useState('');
  const [password, setPasswordValue] = useState('');
  const { pending, error, run } = useAccountAction();

  const issue = password.length > 0 ? firstIssue(passwordSchema, password) : null;
  const ready = password.length > 0 && !issue && (!change || current.length > 0);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready || pending) return;
    if (await run(() => setPassword(password, change ? current : undefined))) onDone();
  };

  return (
    <form className="account-form" onSubmit={submit} noValidate>
      {change ? (
        <AccountField
          label="Senha atual"
          type="password"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
          maxLength={PASSWORD_MAX}
          testId="account-current-password-input"
        />
      ) : null}
      <AccountField
        label={change ? 'Nova senha' : 'Senha'}
        type="password"
        value={password}
        onChange={setPasswordValue}
        autoComplete="new-password"
        maxLength={PASSWORD_MAX}
        error={issue}
        hint={change ? undefined : 'Com ela você entra em outro aparelho usando seu apelido. De 6 a 72 caracteres.'}
        testId="account-new-password-input"
      />
      {error ? (
        <p className="save-warning" data-tone="bad" role="alert">
          {error.message}
        </p>
      ) : null}
      <div className="account-actions">
        <Button size="sm" type="submit" disabled={!ready || pending} data-qa="account-save-password">
          {pending ? 'Salvando…' : 'Salvar senha'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
