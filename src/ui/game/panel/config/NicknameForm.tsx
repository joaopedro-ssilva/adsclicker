import { useState, type FormEvent } from 'react';
import { useCloud } from '@/game/cloud';
import { NICKNAME_MAX, PASSWORD_MAX, nicknameSchema, passwordSchema } from '@/shared/api';
import { Button } from '@/ui/kit';
import { AccountField } from './AccountField';
import { useAccountAction } from './useAccountAction';
import { firstIssue } from './validate';

/** Guest without a nickname: pick one to enter the ranking, with an optional password for other devices. */
export function NicknameForm({ onPasswordFailed }: { onPasswordFailed: (message: string) => void }) {
  const setNickname = useCloud((store) => store.setNickname);
  const setPassword = useCloud((store) => store.setPassword);
  const [nickname, setNicknameValue] = useState('');
  const [password, setPasswordValue] = useState('');
  const { pending, error, run } = useAccountAction();

  const nicknameIssue = nickname.length > 0 ? firstIssue(nicknameSchema, nickname) : null;
  const passwordIssue = password.length > 0 ? firstIssue(passwordSchema, password) : null;
  const ready = nickname.trim().length > 0 && !nicknameIssue && !passwordIssue;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready || pending) return;
    await run(async () => {
      const named = await setNickname(nickname.trim());
      if (!named.ok || password.length === 0) return named;
      // The nickname is taken now: if only the password fails, say so instead of undoing the first step.
      const protectedAccount = await setPassword(password);
      if (!protectedAccount.ok) onPasswordFailed(protectedAccount.error.message);
      return { ok: true } as const;
    });
  };

  const serverOnNickname = error && (error.code === 'nickname_taken' || error.code === 'invalid');
  const nicknameError = nicknameIssue ?? (serverOnNickname ? error.message : null);
  const formError = error && !serverOnNickname ? error.message : null;

  return (
    <form className="account-form" onSubmit={submit} noValidate>
      <p className="setting-label">Escolha um apelido para entrar no ranking</p>
      <AccountField
        label="Apelido"
        value={nickname}
        onChange={setNicknameValue}
        autoComplete="username"
        maxLength={NICKNAME_MAX}
        error={nicknameError}
        hint="De 3 a 16 caracteres. É como os outros jogadores vão te ver."
        testId="account-nickname-input"
      />
      <AccountField
        label="Senha (opcional)"
        type="password"
        value={password}
        onChange={setPasswordValue}
        autoComplete="new-password"
        maxLength={PASSWORD_MAX}
        error={passwordIssue}
        hint="Para jogar em outro aparelho. Pode deixar em branco e criar depois."
        testId="account-password-input"
      />
      {formError ? (
        <p className="save-warning" data-tone="bad" role="alert">
          {formError}
        </p>
      ) : null}
      <Button size="sm" type="submit" disabled={!ready || pending} data-qa="account-save-nickname">
        {pending ? 'Salvando…' : 'Entrar no ranking'}
      </Button>
    </form>
  );
}
